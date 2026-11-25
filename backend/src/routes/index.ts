import { Router } from 'express';
import { analyzeLimiter, conversionLimiter, uploadLimiter } from '../middleware/rate-limit';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  analyzeSchema,
  conversionSchema,
  directDownloadSchema,
  idParamSchema,
  listQuerySchema,
} from '../validation/schemas';
import { uploadSingleMedia } from '../middleware/upload';
import {
  analyzeHandler,
  getMediaHandler,
  uploadHandler,
} from '../controllers/media.controller';
import {
  createConversionHandler,
  directDownloadHandler,
} from '../controllers/conversions.controller';
import {
  cancelJobHandler,
  getJobHandler,
  listJobsHandler,
  queueStatusHandler,
  retryJobHandler,
} from '../controllers/jobs.controller';
import { downloadHandler } from '../controllers/downloads.controller';
import {
  clearHistoryHandler,
  deleteHistoryHandler,
  listHistoryHandler,
} from '../controllers/history.controller';
import {
  getSettingsHandler,
  updateSettingsHandler,
} from '../controllers/settings.controller';
import { healthHandler, systemStatusHandler } from '../controllers/system.controller';
import { settingsSchema } from '../validation/schemas';

export const apiRouter = Router();

apiRouter.get('/health', healthHandler);
apiRouter.get('/system/status', systemStatusHandler);

// Media analysis (direct URL + official YouTube metadata) and local uploads.
apiRouter.post(
  '/media/analyze',
  analyzeLimiter,
  validateBody(analyzeSchema),
  analyzeHandler,
);
apiRouter.post(
  '/media/upload',
  uploadLimiter,
  uploadSingleMedia,
  uploadHandler,
);
apiRouter.get('/media/:id', validateParams(idParamSchema), getMediaHandler);

// Conversions.
apiRouter.post(
  '/conversions',
  conversionLimiter,
  validateBody(conversionSchema),
  createConversionHandler,
);
apiRouter.post(
  '/direct-download',
  conversionLimiter,
  validateBody(directDownloadSchema),
  directDownloadHandler,
);

// Jobs.
apiRouter.get('/jobs', validateQuery(listQuerySchema), listJobsHandler);
apiRouter.get('/jobs/queue/status', queueStatusHandler);
apiRouter.get('/jobs/:id', validateParams(idParamSchema), getJobHandler);
apiRouter.post('/jobs/:id/cancel', validateParams(idParamSchema), cancelJobHandler);
apiRouter.post('/jobs/:id/retry', validateParams(idParamSchema), retryJobHandler);

// Downloads (streamed, Range-capable).
apiRouter.get('/downloads/:id', validateParams(idParamSchema), downloadHandler);

// History.
apiRouter.get('/history', validateQuery(listQuerySchema), listHistoryHandler);
apiRouter.delete('/history', clearHistoryHandler);
apiRouter.delete('/history/:id', validateParams(idParamSchema), deleteHistoryHandler);

// Settings.
apiRouter.get('/settings', getSettingsHandler);
apiRouter.put('/settings', validateBody(settingsSchema), updateSettingsHandler);
