import type { NextFunction, Request, Response } from 'express';
import { getSettings, updateSettings } from '../services/settings.service';
import { setConfiguredFfmpegPath } from '../services/ffmpeg.service';
import { setConfiguredDownloadDir } from '../utils/paths';
import { badRequest } from '../middleware/error-handler';
import { jobRunner } from '../services/job-runner';
import { events, EVENTS } from '../services/event-bus';
import type { SettingsInput } from '../validation/schemas';

export async function getSettingsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
}

export async function updateSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as SettingsInput;
    if (input.downloadDir !== undefined) {
      try {
        setConfiguredDownloadDir(input.downloadDir);
      } catch {
        throw badRequest('Could not create or access that Saved Files folder path.', 'INVALID_DOWNLOAD_DIR');
      }
    }
    const updated = await updateSettings(input);
    if (input.ffmpegPath !== undefined) {
      setConfiguredFfmpegPath(updated.ffmpegPath);
    }
    if (typeof input.maxConcurrentJobs === 'number') {
      await jobRunner.setConcurrency(input.maxConcurrentJobs);
    }
    events.emit(EVENTS.settingsUpdated, updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}
