import type { NextFunction, Request, Response } from 'express';
import { cancelJob, getJobById, listJobs, retryJob } from '../services/job.service';
import { jobRunner } from '../services/job-runner';

export async function listJobsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number((req.query as { limit?: number }).limit ?? 50);
    const jobs = await listJobs(limit);
    res.json(jobs);
  } catch (error) {
    next(error);
  }
}

export async function getJobHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await getJobById(req.params.id);
    res.json(job);
  } catch (error) {
    next(error);
  }
}

export async function cancelJobHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await cancelJob(req.params.id);
    res.json(job);
  } catch (error) {
    next(error);
  }
}

export async function retryJobHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await retryJob(req.params.id);
    res.json(job);
  } catch (error) {
    next(error);
  }
}

export function queueStatusHandler(_req: Request, res: Response) {
  res.json(jobRunner.getStats());
}
