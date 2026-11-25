import type { NextFunction, Request, Response } from 'express';
import { createConversionJob } from '../services/job.service';
import { analyzeMediaUrl } from '../services/media.service';
import type { OutputFormat } from '../validation/schemas';

export async function createConversionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      mediaId: string;
      outputFormat: OutputFormat;
      quality: string;
      fileName?: string;
    };
    const job = await createConversionJob(body);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
}

export async function directDownloadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      url: string;
      outputFormat: OutputFormat;
      quality: string;
      fileName?: string;
    };
    const media = await analyzeMediaUrl(body.url);

    // In 1-step direct mode, clamp requested quality to the highest available
    // option for this format so picking 1080p on a 720p video still works cleanly.
    let quality = body.quality;
    const enabled = media.outputOptions.filter(
      (opt) => opt.format === body.outputFormat && opt.available,
    );
    if (enabled.length > 0 && !enabled.some((opt) => opt.quality === quality)) {
      quality = enabled[enabled.length - 1].quality;
    }

    const job = await createConversionJob({
      mediaId: media.id,
      outputFormat: body.outputFormat,
      quality,
      fileName: body.fileName,
    });
    res.status(201).json({ media, job });
  } catch (error) {
    next(error);
  }
}
