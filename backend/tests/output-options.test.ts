import { describe, expect, it } from 'vitest';
import type { Media } from '@prisma/client';
import { buildOutputOptions, isQualityEnabled } from '../src/services/output-options.service';

type MediaLike = Pick<Media, 'hasAudio' | 'hasVideo' | 'height' | 'duration' | 'sourceType'>;

function media(overrides: Partial<MediaLike> = {}): MediaLike {
  return {
    hasAudio: true,
    hasVideo: true,
    height: 1080,
    duration: 60,
    sourceType: 'upload',
    ...overrides,
  };
}

describe('buildOutputOptions', () => {
  it('enables all audio and video presets for a 1080p source', () => {
    const options = buildOutputOptions(media());
    const enabled = options.filter((option) => option.available);
    expect(enabled.filter((option) => option.format === 'mp3')).toHaveLength(4);
    expect(enabled.filter((option) => option.format === 'mp4')).toHaveLength(4);
  });

  it('disables upscaling above the source height with a reason', () => {
    const options = buildOutputOptions(media({ height: 720 }));
    const fourK = options.find((option) => option.format === 'mp4' && option.quality === '4k');
    expect(fourK?.available).toBe(false);
    expect(fourK?.reason).toMatch(/upscaling/i);
    expect(fourK?.estimatedSize).toBeNull();
    expect(isQualityEnabled(options, 'mp4', '4k')).toBe(false);
    expect(isQualityEnabled(options, 'mp4', '720')).toBe(true);
  });

  it('enables options for YouTube sources up to the probed height', () => {
    const options = buildOutputOptions(media({ sourceType: 'youtube', height: 1080 }));
    expect(options.filter((option) => option.format === 'mp3' && option.available)).toHaveLength(4);
    expect(options.filter((option) => option.format === 'mp4' && option.available)).toHaveLength(4);
    expect(isQualityEnabled(options, 'mp4', '4k')).toBe(false);
  });

  it('disables MP4 when the source has no video stream', () => {
    const options = buildOutputOptions(media({ hasVideo: false, height: null }));
    expect(options.filter((option) => option.format === 'mp4').every((option) => !option.available)).toBe(
      true,
    );
    expect(options.filter((option) => option.format === 'mp3').every((option) => option.available)).toBe(
      true,
    );
  });

  it('disables MP3 when the source has no audio stream', () => {
    const options = buildOutputOptions(media({ hasAudio: false }));
    expect(options.filter((option) => option.format === 'mp3').every((option) => !option.available)).toBe(
      true,
    );
  });

  it('disables MP4 when the source height is unknown', () => {
    const options = buildOutputOptions(media({ height: null }));
    const mp4 = options.filter((option) => option.format === 'mp4');
    expect(mp4.every((option) => !option.available)).toBe(true);
    expect(mp4.every((option) => /resolution/i.test(option.reason ?? ''))).toBe(true);
  });

  it('estimates output size from bitrate and duration', () => {
    const options = buildOutputOptions(media({ duration: 60 }));
    const mp3 = options.find((option) => option.format === 'mp3' && option.quality === '320');
    expect(mp3?.estimatedSize).toBe(Math.round(((320 * 1000) / 8) * 60));
    const mp4 = options.find((option) => option.format === 'mp4' && option.quality === '1080');
    expect(mp4?.estimatedSize).toBe(Math.round((((5000 + 192) * 1000) / 8) * 60));
  });

  it('returns null estimates when the duration is unknown', () => {
    const options = buildOutputOptions(media({ duration: null }));
    expect(options.every((option) => option.estimatedSize === null)).toBe(true);
  });
});
