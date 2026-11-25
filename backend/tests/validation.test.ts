import { describe, expect, it } from 'vitest';
import {
  analyzeSchema,
  conversionSchema,
  idParamSchema,
  listQuerySchema,
  settingsSchema,
} from '../src/validation/schemas';

describe('analyzeSchema', () => {
  it('accepts a URL and trims whitespace', () => {
    expect(analyzeSchema.parse({ url: '  https://example.com/a.mp4  ' }).url).toBe(
      'https://example.com/a.mp4',
    );
  });

  it('rejects short or missing URLs', () => {
    expect(analyzeSchema.safeParse({ url: 'http' }).success).toBe(false);
    expect(analyzeSchema.safeParse({}).success).toBe(false);
  });

  it('rejects oversized input', () => {
    expect(analyzeSchema.safeParse({ url: `https://example.com/${'a'.repeat(2100)}` }).success).toBe(
      false,
    );
  });
});

describe('conversionSchema', () => {
  it('accepts valid MP3 and MP4 requests', () => {
    expect(
      conversionSchema.safeParse({ mediaId: 'cmwv12345', outputFormat: 'mp3', quality: '320' })
        .success,
    ).toBe(true);
    expect(
      conversionSchema.safeParse({
        mediaId: 'cmwv12345',
        outputFormat: 'mp4',
        quality: '1080',
        fileName: 'Holiday clip',
      }).success,
    ).toBe(true);
  });

  it('rejects mismatched quality presets', () => {
    expect(
      conversionSchema.safeParse({ mediaId: 'cmwv12345', outputFormat: 'mp3', quality: '1080' })
        .success,
    ).toBe(false);
    expect(
      conversionSchema.safeParse({ mediaId: 'cmwv12345', outputFormat: 'mp4', quality: '320' })
        .success,
    ).toBe(false);
  });

  it('rejects unknown formats and short ids', () => {
    expect(
      conversionSchema.safeParse({ mediaId: 'cmwv12345', outputFormat: 'wav', quality: '320' })
        .success,
    ).toBe(false);
    expect(
      conversionSchema.safeParse({ mediaId: 'abc', outputFormat: 'mp3', quality: '320' }).success,
    ).toBe(false);
  });
});

describe('settingsSchema', () => {
  it('accepts partial updates', () => {
    expect(settingsSchema.parse({ maxConcurrentJobs: 4 })).toEqual({ maxConcurrentJobs: 4 });
    expect(settingsSchema.parse({ theme: 'light' })).toEqual({ theme: 'light' });
  });

  it('rejects concurrency outside 1–8', () => {
    expect(settingsSchema.safeParse({ maxConcurrentJobs: 0 }).success).toBe(false);
    expect(settingsSchema.safeParse({ maxConcurrentJobs: 9 }).success).toBe(false);
    expect(settingsSchema.safeParse({ maxConcurrentJobs: 3.5 }).success).toBe(false);
  });

  it('rejects unknown keys and invalid theme values', () => {
    expect(settingsSchema.safeParse({ unknownKey: true }).success).toBe(false);
    expect(settingsSchema.safeParse({ theme: 'neon' }).success).toBe(false);
  });

  it('rejects invalid default qualities', () => {
    expect(settingsSchema.safeParse({ defaultAudioQuality: '999' }).success).toBe(false);
    expect(settingsSchema.safeParse({ defaultVideoQuality: '144' }).success).toBe(false);
  });
});

describe('query and param schemas', () => {
  it('coerces and bounds list limits', () => {
    expect(listQuerySchema.parse({}).limit).toBe(50);
    expect(listQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(listQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('validates cuid-like ids', () => {
    expect(idParamSchema.safeParse({ id: 'cmwv12345' }).success).toBe(true);
    expect(idParamSchema.safeParse({ id: '..' }).success).toBe(false);
    expect(idParamSchema.safeParse({ id: 'aa/bb' }).success).toBe(true); // length only; routing prevents slashes
  });
});
