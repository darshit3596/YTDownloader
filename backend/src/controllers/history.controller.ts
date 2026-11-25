import type { NextFunction, Request, Response } from 'express';
import {
  clearHistory,
  deleteHistoryEntry,
  listHistory,
} from '../services/history.service';

export async function listHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number((req.query as { limit?: number }).limit ?? 100);
    res.json(await listHistory(limit));
  } catch (error) {
    next(error);
  }
}

export async function deleteHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await deleteHistoryEntry(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function clearHistoryHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await clearHistory());
  } catch (error) {
    next(error);
  }
}
