import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { prisma } from '../database/prisma';
import { getSettings } from '../services/settings.service';
import { getToolStatus } from '../services/ffmpeg.service';
import { jobRunner } from '../services/job-runner';
import { directorySize, getDownloadsDir, storagePaths } from '../utils/paths';

export async function healthHandler(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, version: config.version });
  } catch {
    res.status(503).json({
      ok: false,
      version: config.version,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.' },
    });
  }
}

export async function systemStatusHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getSettings();
    const tools = await getToolStatus(settings.ffmpegPath || undefined);
    const [uploads, downloads, temp] = await Promise.all([
      directorySize(storagePaths.uploads),
      directorySize(getDownloadsDir()),
      directorySize(storagePaths.temp),
    ]);

    res.json({
      ok: tools.ffmpeg.available && tools.ffprobe.available,
      ffmpeg: tools.ffmpeg,
      ffprobe: { available: tools.ffprobe.available, version: tools.ffprobe.version },
      youtubeApi: { configured: Boolean(config.youtubeApiKey) },
      queue: jobRunner.getStats(),
      storage: { uploads, downloads, temp },
      version: config.version,
    });
  } catch (error) {
    next(error);
  }
}
