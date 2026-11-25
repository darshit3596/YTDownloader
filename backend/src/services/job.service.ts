import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../database/prisma';
import { AppError, badRequest, conflict, notFound } from '../middleware/error-handler';
import { buildOutputOptions, isQualityEnabled } from './output-options.service';
import { toJobDto } from './serializers';
import { sanitizeBaseName } from '../utils/files';
import { getDownloadsDir, safeUnlink } from '../utils/paths';
import { events, EVENTS } from './event-bus';
import { jobRunner } from './job-runner';
import type { JobDto } from '../types';
import type { OutputFormat } from '../validation/schemas';

async function uniqueOutputPath(baseName: string, extension: string): Promise<string> {
  const directory = getDownloadsDir();
  const safeBase = sanitizeBaseName(baseName, 'mediaflow-output');
  const activeJobs = await prisma.job.findMany({
    where: { status: { in: ['queued', 'processing'] }, outputPath: { not: null } },
    select: { outputPath: true },
  });
  const reserved = new Set(activeJobs.map((j) => j.outputPath).filter(Boolean));
  let candidate = path.join(directory, `${safeBase}.${extension}`);
  let counter = 1;
  while (fs.existsSync(candidate) || reserved.has(candidate)) {
    candidate = path.join(directory, `${safeBase} (${counter}).${extension}`);
    counter += 1;
    if (counter > 500) {
      throw new AppError(500, 'OUTPUT_NAME_EXHAUSTED', 'Could not allocate an output file name.');
    }
  }
  return candidate;
}

export async function createConversionJob(input: {
  mediaId: string;
  outputFormat: OutputFormat;
  quality: string;
  fileName?: string;
}): Promise<JobDto> {
  const media = await prisma.media.findUnique({ where: { id: input.mediaId } });
  if (!media) {
    throw notFound('The analyzed media could not be found. Analyze the source again.', 'MEDIA_NOT_FOUND');
  }

  const options = buildOutputOptions(media);
  if (!isQualityEnabled(options, input.outputFormat, input.quality)) {
    const option = options.find(
      (candidate) => candidate.format === input.outputFormat && candidate.quality === input.quality,
    );
    throw badRequest(
      option?.reason ?? 'That format and quality are not supported for this source.',
      'UNSUPPORTED_OUTPUT',
    );
  }

  if (media.sourceType === 'youtube') {
    if (!media.sourceUrl) {
      throw conflict('The YouTube URL is missing for this media item.', 'SOURCE_MISSING');
    }
  } else if (!media.storedPath || !fs.existsSync(media.storedPath)) {
    throw conflict(
      'The source media is no longer available on disk. Analyze or upload it again.',
      'SOURCE_MISSING',
    );
  }

  const duplicate = await prisma.job.findFirst({
    where: {
      mediaId: media.id,
      outputFormat: input.outputFormat,
      quality: input.quality,
      status: { in: ['queued', 'processing'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (duplicate) {
    throw conflict(
      'An active job for this media, format and quality already exists.',
      'DUPLICATE_JOB',
      { jobId: duplicate.id },
    );
  }

  const extension = input.outputFormat === 'mp3' ? 'mp3' : 'mp4';
  const baseName = sanitizeBaseName(input.fileName || media.title || media.fileName || 'mediaflow-output');
  const outputPath = await uniqueOutputPath(baseName, extension);
  const outputFileName = path.basename(outputPath);

  const created = await prisma.job.create({
    data: {
      mediaId: media.id,
      outputFormat: input.outputFormat,
      quality: input.quality,
      status: 'queued',
      progress: 0,
      outputPath,
      fileName: outputFileName,
    },
    include: { media: true },
  });

  const dto = toJobDto(created);
  events.emit(EVENTS.jobCreated, dto);
  jobRunner.enqueue(created.id);

  return dto;
}

export async function listJobs(limit: number): Promise<JobDto[]> {
  const jobs = await prisma.job.findMany({
    include: { media: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return jobs.map(toJobDto);
}

export async function getJobById(id: string): Promise<JobDto> {
  const job = await prisma.job.findUnique({ where: { id }, include: { media: true } });
  if (!job) throw notFound('That job does not exist.', 'JOB_NOT_FOUND');
  return toJobDto(job);
}

export async function cancelJob(id: string): Promise<JobDto> {
  const job = await prisma.job.findUnique({ where: { id }, include: { media: true } });
  if (!job) throw notFound('That job does not exist.', 'JOB_NOT_FOUND');

  if (job.status !== 'queued' && job.status !== 'processing') {
    throw conflict('Only queued or processing jobs can be cancelled.', 'JOB_NOT_CANCELLABLE');
  }

  if (jobRunner.isActive(id)) {
    await jobRunner.cancel(id);
    const updated = await prisma.job.findUnique({ where: { id }, include: { media: true } });
    if (!updated) throw notFound('That job no longer exists.', 'JOB_NOT_FOUND');
    return toJobDto(updated);
  }

  jobRunner.markCancelled(id);
  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: 'cancelled',
      speed: null,
      etaSeconds: null,
      completedAt: new Date(),
      errorMessage: null,
    },
    include: { media: true },
  });
  if (job.outputPath) await safeUnlink(job.outputPath);
  const dto = toJobDto(updated);
  events.emit(EVENTS.jobUpdated, dto);
  jobRunner.publishStats();
  return dto;
}

export async function retryJob(id: string): Promise<JobDto> {
  const job = await prisma.job.findUnique({ where: { id }, include: { media: true } });
  if (!job) throw notFound('That job does not exist.', 'JOB_NOT_FOUND');

  if (!['failed', 'cancelled'].includes(job.status)) {
    throw conflict('Only failed or cancelled jobs can be retried.', 'JOB_NOT_RETRYABLE');
  }
  if (job.media.sourceType === 'youtube') {
    if (!job.media.sourceUrl) {
      throw conflict('The YouTube URL is missing for this job.', 'SOURCE_MISSING');
    }
  } else if (!job.media.storedPath || !fs.existsSync(job.media.storedPath)) {
    throw conflict(
      'The original source file has been cleaned up. Analyze or upload it again.',
      'SOURCE_MISSING',
    );
  }

  if (job.outputPath) await safeUnlink(job.outputPath);
  const baseName = sanitizeBaseName(job.fileName ?? job.media.title, 'mediaflow-output').replace(
    /\.(mp3|mp4)$/i,
    '',
  );
  const extension = job.outputFormat === 'mp3' ? 'mp3' : 'mp4';
  const outputPath = await uniqueOutputPath(baseName, extension);
  const outputFileName = path.basename(outputPath);

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: 'queued',
      progress: 0,
      speed: null,
      etaSeconds: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      fileSize: null,
      outputPath,
      fileName: outputFileName,
      attempts: { increment: 1 },
    },
    include: { media: true },
  });

  const dto = toJobDto(updated);
  events.emit(EVENTS.jobUpdated, dto);
  jobRunner.enqueue(updated.id);
  return dto;
}
