import fs from 'node:fs';
import { prisma } from '../database/prisma';
import { config } from '../config';
import { getSettings } from './settings.service';
import { startConversion, type ConversionHandle } from './ffmpeg.service';
import { startYouTubeDownload } from './ytdlp.service';
import { toJobDto } from './serializers';
import { events, EVENTS } from './event-bus';
import { safeUnlink, storageRoot } from '../utils/paths';
import { createLogger } from '../utils/logger';
import type { QueueStats } from '../types';

const logger = createLogger('job-runner');

function friendlyFfmpegError(stderr: string): string {
  const clean = stderr
    .replaceAll(storageRoot, '[storage]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'FFmpeg exited without producing a valid output file.';
  if (/invalid data found/i.test(clean)) {
    return 'The source media contains data FFmpeg could not decode.';
  }
  if (/unknown encoder|encoder .* not found/i.test(clean)) {
    return 'The required FFmpeg encoder is not available in this FFmpeg build.';
  }
  if (/no space left/i.test(clean)) {
    return 'The disk is full. Free up space and retry the job.';
  }
  if (/permission denied/i.test(clean)) {
    return 'Permission denied while reading the source or writing the output.';
  }
  return clean.slice(-320);
}

class JobRunner {
  private pending: string[] = [];
  private running = new Map<string, ConversionHandle>();
  private starting = new Set<string>();
  private completions = new Map<string, Promise<void>>();
  private cancelledIds = new Set<string>();
  private concurrency: number = config.defaults.maxConcurrentJobs;
  private stopped = false;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const settings = await getSettings().catch(() => null);
    if (settings) this.concurrency = settings.maxConcurrentJobs;

    const interrupted = await prisma.job.findMany({
      where: { status: 'processing' },
      include: { media: true },
    });

    for (const job of interrupted) {
      if (job.outputPath) await safeUnlink(job.outputPath);
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: 'The job was interrupted by a server restart. Retry to process it again.',
          speed: null,
          etaSeconds: null,
          completedAt: new Date(),
        },
        include: { media: true },
      });
      events.emit(EVENTS.jobUpdated, toJobDto(updated));
    }

    const queued = await prisma.job.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    for (const job of queued) {
      if (!this.pending.includes(job.id)) this.pending.push(job.id);
    }

    logger.info('queue initialized', {
      concurrency: this.concurrency,
      queued: this.pending.length,
      interrupted: interrupted.length,
    });

    this.publishStats();
    this.pump();
  }

  private publishStatsNow() {
    const stats: QueueStats = {
      active: this.running.size + this.starting.size,
      queued: this.pending.length,
      maxConcurrent: this.concurrency,
    };
    events.emit(EVENTS.queueStats, stats);
  }

  publishStats(): void {
    this.publishStatsNow();
  }

  async setConcurrency(value: number): Promise<void> {
    this.concurrency = Math.max(1, Math.min(8, Math.trunc(value)));
    this.publishStatsNow();
    this.pump();
  }

  isActive(id: string): boolean {
    return this.running.has(id) || this.starting.has(id);
  }

  getStats(): QueueStats {
    return {
      active: this.running.size + this.starting.size,
      queued: this.pending.length,
      maxConcurrent: this.concurrency,
    };
  }

  enqueue(id: string): void {
    if (this.stopped) return;
    if (this.running.has(id) || this.pending.includes(id)) return;
    // A retried job reuses its id; clear any lingering cancellation marker.
    this.cancelledIds.delete(id);
    this.pending.push(id);
    this.publishStatsNow();
    this.pump();
  }

  removeQueued(id: string): boolean {
    const before = this.pending.length;
    this.pending = this.pending.filter((queuedId) => queuedId !== id);
    const removed = this.pending.length !== before;
    if (removed) this.publishStatsNow();
    return removed;
  }

  markCancelled(id: string): void {
    this.cancelledIds.add(id);
    this.removeQueued(id);
    setTimeout(() => this.cancelledIds.delete(id), 60_000).unref?.();
  }

  async cancel(id: string): Promise<void> {
    this.markCancelled(id);
    this.running.get(id)?.cancel();
    // The job may be starting up (registered in `completions` but not yet in
    // `running`), so always wait for its completion promise if one exists.
    const completion = this.completions.get(id);
    if (completion) await completion;
  }

  private pump(): void {
    if (this.stopped) return;
    while (this.running.size + this.starting.size < this.concurrency && this.pending.length > 0) {
      const id = this.pending.shift();
      if (!id || this.running.has(id) || this.starting.has(id)) continue;
      if (this.cancelledIds.has(id)) continue;

      this.starting.add(id);
      const completion = this.runJob(id)
        .catch((error) => {
          logger.error('unhandled job error', { id, error: (error as Error).message });
        })
        .finally(() => {
          this.starting.delete(id);
          this.completions.delete(id);
          this.cancelledIds.delete(id);
          this.publishStatsNow();
          this.pump();
        });
      this.completions.set(id, completion);
    }
    this.publishStatsNow();
  }

  private async runJob(id: string): Promise<void> {
    const job = await prisma.job.findUnique({ where: { id }, include: { media: true } });
    if (!job || job.status !== 'queued' || this.stopped || this.cancelledIds.has(id)) {
      return;
    }

    const fail = async (message: string) => {
      if (job.outputPath) await safeUnlink(job.outputPath);
      const updated = await prisma.job
        .update({
          where: { id },
          data: {
            status: 'failed',
            errorMessage: message,
            speed: null,
            etaSeconds: null,
            completedAt: new Date(),
          },
          include: { media: true },
        })
        .catch(() => null);
      if (updated) events.emit(EVENTS.jobUpdated, toJobDto(updated));
      logger.warn('job failed', { id, message });
    };

    const sourcePath = job.media.storedPath;
    if (job.media.sourceType === 'youtube') {
      if (!job.media.sourceUrl) {
        await fail('The YouTube URL is missing for this job.');
        return;
      }
    } else if (!sourcePath || !fs.existsSync(sourcePath)) {
      await fail('The source file is no longer available on disk. Analyze or upload it again.');
      return;
    }
    if (!job.outputPath) {
      await fail('The job has no output path configured.');
      return;
    }

    let latest = await prisma.job.update({
      where: { id },
      data: { status: 'processing', progress: 0, startedAt: new Date(), errorMessage: null },
      include: { media: true },
    });
    events.emit(EVENTS.jobUpdated, toJobDto(latest));
    this.publishStatsNow();

    // A cancel can land between the queue lookup and this point.
    if (this.cancelledIds.has(id)) {
      await safeUnlink(job.outputPath);
      const cancelledJob = await prisma.job
        .update({
          where: { id },
          data: {
            status: 'cancelled',
            speed: null,
            etaSeconds: null,
            completedAt: new Date(),
            errorMessage: null,
          },
          include: { media: true },
        })
        .catch(() => null);
      if (cancelledJob) events.emit(EVENTS.jobUpdated, toJobDto(cancelledJob));
      return;
    }

    let lastPersist = 0;
    let lastEmittedPercent = -1;

    const onProgress = (progress: {
      percent: number;
      bytes: number | null;
      speed: number | null;
      etaSeconds: number | null;
    }) => {
      latest = {
        ...latest,
        progress: Math.min(99, progress.percent),
        speed: progress.speed,
        etaSeconds: progress.etaSeconds,
      };
      const percentRounded = Math.round(latest.progress);
      if (percentRounded !== lastEmittedPercent) {
        lastEmittedPercent = percentRounded;
        events.emit(EVENTS.jobUpdated, toJobDto(latest));
      }
      const now = Date.now();
      if (now - lastPersist > 2000) {
        lastPersist = now;
        void prisma.job
          .update({
            where: { id },
            data: {
              progress: latest.progress,
              speed: latest.speed,
              etaSeconds: latest.etaSeconds,
            },
          })
          .catch(() => undefined);
      }
    };

    const handle =
      job.media.sourceType === 'youtube'
        ? startYouTubeDownload(
            {
              url: job.media.sourceUrl!,
              outputPath: job.outputPath,
              format: job.outputFormat as 'mp3' | 'mp4',
              quality: job.quality,
            },
            onProgress,
          )
        : startConversion(
            {
              inputPath: sourcePath!,
              outputPath: job.outputPath,
              format: job.outputFormat as 'mp3' | 'mp4',
              quality: job.quality,
              duration: job.media.duration,
              hasAudio: job.media.hasAudio,
              hasVideo: job.media.hasVideo,
            },
            onProgress,
          );

    this.running.set(id, handle);
    // Cancel may have arrived while `startConversion` was being set up.
    if (this.cancelledIds.has(id)) handle.cancel();
    this.publishStatsNow();

    const result = await handle.promise;
    this.running.delete(id);
    this.publishStatsNow();

    if (result.cancelled || this.cancelledIds.has(id)) {
      await safeUnlink(job.outputPath);
      const updated = await prisma.job
        .update({
          where: { id },
          data: {
            status: 'cancelled',
            speed: null,
            etaSeconds: null,
            completedAt: new Date(),
            errorMessage: null,
          },
          include: { media: true },
        })
        .catch(() => null);
      if (updated) events.emit(EVENTS.jobUpdated, toJobDto(updated));
      logger.info('job cancelled', { id });
      return;
    }

    if (result.timedOut) {
      await fail(
        `Conversion exceeded the ${Math.round(config.limits.ffmpegTimeoutMs / 60000)} minute limit.`,
      );
      return;
    }

    if (result.code !== 0) {
      await fail(friendlyFfmpegError(result.stderr));
      return;
    }

    let size = 0;
    try {
      size = (await fs.promises.stat(job.outputPath)).size;
    } catch {
      size = 0;
    }

    if (size <= 0) {
      await fail('FFmpeg reported success but no output file was produced.');
      return;
    }

    const completed = await prisma.job.update({
      where: { id },
      data: {
        status: 'completed',
        progress: 100,
        fileSize: size,
        speed: null,
        etaSeconds: null,
        completedAt: new Date(),
        errorMessage: null,
      },
      include: { media: true },
    });

    try {
      await prisma.history.upsert({
        where: { jobId: id },
        create: {
          jobId: id,
          fileName: completed.fileName ?? 'output',
          format: completed.outputFormat,
          fileSize: size,
        },
        update: {
          fileName: completed.fileName ?? 'output',
          format: completed.outputFormat,
          fileSize: size,
        },
      });
      events.emit(EVENTS.historyChanged);
    } catch (error) {
      logger.warn('failed to write history entry', { id, error: (error as Error).message });
    }

    events.emit(EVENTS.jobUpdated, toJobDto(completed));
    logger.info('job completed', { id, size });
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    logger.info('queue shutting down', { active: this.running.size, queued: this.pending.length });
    const ids = [...this.running.keys()];
    await Promise.all(
      ids.map(async (id) => {
        try {
          await this.cancel(id);
          const job = await prisma.job.findUnique({ where: { id } });
          if (job?.outputPath) await safeUnlink(job.outputPath);
          await prisma.job.update({
            where: { id },
            data: {
              status: 'failed',
              errorMessage: 'The server shut down before this job finished. Retry to process it again.',
              speed: null,
              etaSeconds: null,
              completedAt: new Date(),
            },
          });
        } catch {
          // Best-effort shutdown.
        }
      }),
    );
  }
}

export const jobRunner = new JobRunner();
