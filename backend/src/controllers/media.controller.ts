import type { NextFunction, Request, Response } from 'express';
import { analyzeMediaUrl, getMediaById, registerUploadedMedia } from '../services/media.service';
import { badRequest } from '../middleware/error-handler';

export async function analyzeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { url } = req.body as { url: string };
    const media = await analyzeMediaUrl(url);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
}

export async function getMediaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const media = await getMediaById(req.params.id);
    res.json(media);
  } catch (error) {
    next(error);
  }
}

export async function uploadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw badRequest('Attach a media file in the "file" field.', 'FILE_REQUIRED');
    }
    const media = await registerUploadedMedia({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype ?? null,
      size: req.file.size,
    });
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
}
