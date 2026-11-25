import type { Media } from '@prisma/client';
import type { OutputOption } from '../types';

const AUDIO_PRESETS = [
  { quality: '128', label: '128 kbps', description: 'Compact' },
  { quality: '192', label: '192 kbps', description: 'Balanced' },
  { quality: '256', label: '256 kbps', description: 'High fidelity' },
  { quality: '320', label: '320 kbps', description: 'Maximum' },
] as const;

const VIDEO_PRESETS = [
  { quality: '360', label: '360p', description: 'Mobile', targetHeight: 360, kbps: 800 },
  { quality: '480', label: '480p', description: 'SD', targetHeight: 480, kbps: 1400 },
  { quality: '720', label: '720p', description: 'HD', targetHeight: 720, kbps: 2800 },
  { quality: '1080', label: '1080p', description: 'Full HD', targetHeight: 1080, kbps: 5000 },
  { quality: '4k', label: '4K', description: 'Ultra HD', targetHeight: 2160, kbps: 18000 },
] as const;

type MediaLike = Pick<
  Media,
  'hasAudio' | 'hasVideo' | 'height' | 'duration' | 'sourceType'
>;

function estimateAudioSize(kbps: number, duration: number | null): number | null {
  if (!duration || duration <= 0) return null;
  return Math.round(((kbps * 1000) / 8) * duration);
}

function estimateVideoSize(kbps: number, duration: number | null): number | null {
  if (!duration || duration <= 0) return null;
  const totalKbps = kbps + 192;
  return Math.round(((totalKbps * 1000) / 8) * duration);
}

/**
 * Builds the output matrix for a specific source.
 * Unsupported options are returned as disabled with a human-readable reason.
 */
export function buildOutputOptions(media: MediaLike): OutputOption[] {
  const options: OutputOption[] = [];

  for (const preset of AUDIO_PRESETS) {
    const available = media.hasAudio;
    const reason = !media.hasAudio ? 'This source has no audio stream.' : undefined;

    options.push({
      format: 'mp3',
      quality: preset.quality,
      label: preset.label,
      description: preset.description,
      available,
      reason,
      estimatedSize: available ? estimateAudioSize(Number(preset.quality), media.duration) : null,
    });
  }

  for (const preset of VIDEO_PRESETS) {
    let available = media.hasVideo;
    let reason: string | undefined;

    if (!media.hasVideo) {
      reason = 'This source has no video stream.';
    } else if (!media.height) {
      available = false;
      reason = 'Source resolution could not be determined.';
    } else if (
      media.height < preset.targetHeight &&
      !(media.sourceType === 'youtube' && preset.quality === '360' && media.height > 0)
    ) {
      available = false;
      reason = `Source is ${media.height}p — upscaling is disabled.`;
    }

    options.push({
      format: 'mp4',
      quality: preset.quality,
      label: preset.label,
      description: preset.description,
      available,
      reason,
      estimatedSize: available ? estimateVideoSize(preset.kbps, media.duration) : null,
    });
  }

  return options;
}

export const VIDEO_TARGET_HEIGHTS: Record<string, number> = {
  '360': 360,
  '480': 480,
  '720': 720,
  '1080': 1080,
  '4k': 2160,
};

export const MP4_CRF: Record<string, number> = {
  '360': 26,
  '480': 25,
  '720': 23,
  '1080': 21,
  '4k': 19,
};

export function isQualityEnabled(options: OutputOption[], format: string, quality: string): boolean {
  return Boolean(
    options.find((option) => option.format === format && option.quality === quality && option.available),
  );
}
