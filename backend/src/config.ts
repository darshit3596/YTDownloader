import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const numeric = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: numeric(4000, 1, 65535),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),
  STORAGE_ROOT: z.string().optional(),
  MAX_UPLOAD_MB: numeric(512, 1, 4096),
  MAX_REMOTE_FILE_MB: numeric(1024, 1, 8192),
  MAX_CONCURRENT_JOBS: numeric(1, 1, 8),
  AUTO_CLEANUP_HOURS: numeric(24, 1, 720),
  RATE_LIMIT_MAX: numeric(240, 10, 100000),
  FFMPEG_TIMEOUT_MINUTES: numeric(45, 1, 600),
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
  YTDLP_PATH: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('[config] Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}
const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  clientOrigins: env.CLIENT_ORIGIN.split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  storageRoot: env.STORAGE_ROOT ? path.resolve(env.STORAGE_ROOT) : undefined,
  limits: {
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    maxRemoteFileBytes: env.MAX_REMOTE_FILE_MB * 1024 * 1024,
    rateLimitMax: env.RATE_LIMIT_MAX,
    ffmpegTimeoutMs: env.FFMPEG_TIMEOUT_MINUTES * 60 * 1000,
  },
  defaults: {
    maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
    autoCleanupHours: env.AUTO_CLEANUP_HOURS,
  },
  ffmpegPath: env.FFMPEG_PATH?.trim() || undefined,
  ffprobePath: env.FFPROBE_PATH?.trim() || undefined,
  ytdlpPath: env.YTDLP_PATH?.trim() || undefined,
  youtubeApiKey: env.YOUTUBE_API_KEY?.trim() || undefined,
  version: '1.0.0',
} as const;

export type AppConfig = typeof config;
