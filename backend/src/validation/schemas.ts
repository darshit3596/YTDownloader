import { z } from 'zod';

export const AUDIO_QUALITIES = ['128', '192', '256', '320'] as const;
export const VIDEO_QUALITIES = ['360', '480', '720', '1080', '4k'] as const;
export const OUTPUT_FORMATS = ['mp3', 'mp4'] as const;

export type AudioQuality = (typeof AUDIO_QUALITIES)[number];
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const analyzeSchema = z.object({
  url: z
    .string({ required_error: 'A media URL is required.' })
    .trim()
    .min(8, 'Enter a complete media URL.')
    .max(2048, 'The URL is too long.'),
});

export const conversionSchema = z
  .object({
    mediaId: z.string().trim().min(5).max(64),
    outputFormat: z.enum(OUTPUT_FORMATS),
    quality: z.string().trim().min(1).max(8),
    fileName: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.outputFormat === 'mp3' && !(AUDIO_QUALITIES as readonly string[]).includes(value.quality)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quality'],
        message: `MP3 quality must be one of ${AUDIO_QUALITIES.join(', ')}.`,
      });
    }
    if (value.outputFormat === 'mp4' && !(VIDEO_QUALITIES as readonly string[]).includes(value.quality)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quality'],
        message: `MP4 quality must be one of ${VIDEO_QUALITIES.join(', ')}.`,
      });
    }
  });

export const directDownloadSchema = z
  .object({
    url: z
      .string({ required_error: 'A media URL is required.' })
      .trim()
      .min(8, 'Enter a complete media URL.')
      .max(2048, 'The URL is too long.'),
    outputFormat: z.enum(OUTPUT_FORMATS),
    quality: z.string().trim().min(1).max(8),
    fileName: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.outputFormat === 'mp3' && !(AUDIO_QUALITIES as readonly string[]).includes(value.quality)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quality'],
        message: `MP3 quality must be one of ${AUDIO_QUALITIES.join(', ')}.`,
      });
    }
    if (value.outputFormat === 'mp4' && !(VIDEO_QUALITIES as readonly string[]).includes(value.quality)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quality'],
        message: `MP4 quality must be one of ${VIDEO_QUALITIES.join(', ')}.`,
      });
    }
  });

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(5).max(64),
});

export const settingsSchema = z
  .object({
    ffmpegPath: z.string().max(500).optional(),
    downloadDir: z.string().trim().max(500).optional(),
    maxConcurrentJobs: z.coerce.number().int().min(1).max(8).optional(),
    autoCleanupHours: z.coerce.number().int().min(1).max(720).optional(),
    keepOriginalUploads: z.boolean().optional(),
    defaultAudioQuality: z.enum(AUDIO_QUALITIES).optional(),
    defaultVideoQuality: z.enum(VIDEO_QUALITIES).optional(),
    theme: z.enum(['dark', 'light']).optional(),
  })
  .strict();

export type SettingsInput = z.infer<typeof settingsSchema>;
