import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../database/prisma';
import { getSettings } from './settings.service';
import { safeUnlink, storagePaths } from '../utils/paths';
import { createLogger } from '../utils/logger';

const logger = createLogger('cleanup');
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

async function activeSourcePaths(): Promise<Set<string>> {
  const jobs = await prisma.job.findMany({
    where: { status: { in: ['queued', 'processing'] } },
    include: { media: { select: { storedPath: true } } },
  });
  return new Set(
    jobs.map((job) => job.media.storedPath).filter((value): value is string => Boolean(value)),
  );
}

async function removeStaleFiles(directory: string, cutoff: number, protectedPaths: Set<string>) {
  let removed = 0;
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch {
    return removed;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(directory, entry.name);
    if (protectedPaths.has(fullPath)) continue;
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        await safeUnlink(fullPath);
        removed += 1;
      }
    } catch {
      // Ignore races with active conversions.
    }
  }
  return removed;
}

export async function runCleanup(): Promise<{ temp: number; uploads: number }> {
  const settings = await getSettings().catch(() => null);
  const hours = settings?.autoCleanupHours ?? 24;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const activePaths = await activeSourcePaths();

  const temp = await removeStaleFiles(storagePaths.temp, cutoff, activePaths);
  let uploads = 0;

  if (settings && !settings.keepOriginalUploads) {
    const staleMedia = await prisma.media.findMany({
      where: {
        storedPath: { not: null },
        createdAt: { lt: new Date(cutoff) },
      },
      select: { id: true, storedPath: true },
    });

    for (const media of staleMedia) {
      if (!media.storedPath || activePaths.has(media.storedPath)) continue;
      await safeUnlink(media.storedPath);
      await prisma.media
        .update({ where: { id: media.id }, data: { storedPath: null } })
        .catch(() => undefined);
      uploads += 1;
    }
  }

  if (temp || uploads) logger.info('cleanup sweep finished', { temp, uploads, retentionHours: hours });
  return { temp, uploads };
}

export function startCleanupScheduler(): void {
  if (timer) return;
  setTimeout(() => {
    void runCleanup().catch((error) =>
      logger.error('initial cleanup failed', { error: (error as Error).message }),
    );
  }, 30_000).unref?.();

  timer = setInterval(() => {
    void runCleanup().catch((error) =>
      logger.error('cleanup failed', { error: (error as Error).message }),
    );
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
}

export function stopCleanupScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
