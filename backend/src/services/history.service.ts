import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../database/prisma';
import { notFound } from '../middleware/error-handler';
import { getDownloadsDir, isPathInside, safeUnlink, storagePaths } from '../utils/paths';
import { events, EVENTS } from './event-bus';
import { toHistoryDto } from './serializers';
import type { HistoryDto } from '../types';

export async function listHistory(limit: number): Promise<HistoryDto[]> {
  const entries = await prisma.history.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return entries.map(toHistoryDto);
}

async function removeOutputFile(jobId: string | null): Promise<void> {
  if (!jobId) return;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job?.outputPath) return;
  if (isPathInside(job.outputPath, getDownloadsDir()) || isPathInside(job.outputPath, storagePaths.downloads)) {
    await safeUnlink(job.outputPath);
    await prisma.job
      .update({ where: { id: job.id }, data: { outputPath: null } })
      .catch(() => undefined);
  }
}

export async function deleteHistoryEntry(id: string): Promise<{ deleted: boolean }> {
  const entry = await prisma.history.findUnique({ where: { id } });
  if (!entry) throw notFound('That history entry does not exist.', 'HISTORY_NOT_FOUND');

  await removeOutputFile(entry.jobId);
  await prisma.history.delete({ where: { id } });
  events.emit(EVENTS.historyChanged);
  return { deleted: true };
}

export async function clearHistory(): Promise<{ deleted: number }> {
  const entries = await prisma.history.findMany();
  for (const entry of entries) {
    await removeOutputFile(entry.jobId);
  }
  const result = await prisma.history.deleteMany();
  events.emit(EVENTS.historyChanged);
  return { deleted: result.count };
}

export function resolveDownloadPath(outputPath: string | null): string {
  if (!outputPath) throw notFound('This job has no output file yet.', 'FILE_NOT_READY');
  if (!isPathInside(outputPath, getDownloadsDir()) && !isPathInside(outputPath, storagePaths.downloads)) {
    throw notFound('The output file could not be located.', 'FILE_NOT_FOUND');
  }
  const resolved = path.resolve(outputPath);
  if (!fs.existsSync(resolved)) {
    throw notFound('The output file has been removed from storage.', 'FILE_NOT_FOUND');
  }
  return resolved;
}
