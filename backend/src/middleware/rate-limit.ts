import { rateLimit } from 'express-rate-limit';
import { config } from '../config';

const handler = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again shortly.',
    },
  });
};

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => config.isTest,
  handler,
};

export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: config.limits.rateLimitMax,
});

export const analyzeLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 20,
});

export const conversionLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 30,
});

export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60_000,
  limit: 20,
});
