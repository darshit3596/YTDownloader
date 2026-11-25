import { AppError } from '../middleware/error-handler';
import { probeYouTube } from '../services/ytdlp.service';
import type { AnalyzedMedia, MediaProvider } from './types';

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');

  if (hostname === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && ID_PATTERN.test(id) ? id : null;
  }

  if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return id && ID_PATTERN.test(id) ? id : null;
    }
    const match = parsed.pathname.match(/^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
    if (match) return match[2];
  }

  return null;
}

export function isYouTubeUrl(input: string): boolean {
  try {
    const hostname = new URL(input).hostname.toLowerCase();
    return (
      hostname === 'youtu.be' ||
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com')
    );
  } catch {
    return false;
  }
}

export const youtubeProvider: MediaProvider = {
  id: 'youtube',
  label: 'YouTube (yt-dlp)',

  canHandle(url: string): boolean {
    return isYouTubeUrl(url);
  },

  async analyze(url: string): Promise<AnalyzedMedia> {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      throw new AppError(
        400,
        'INVALID_YOUTUBE_URL',
        'That YouTube URL does not contain a recognizable video ID.',
      );
    }

    const probed = await probeYouTube(url);

    return {
      sourceUrl: url,
      title: probed.title,
      thumbnail: probed.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: probed.duration,
      sourceType: 'youtube',
      provider: 'youtube',
      mimeType: probed.hasVideo ? 'video/mp4' : 'audio/mpeg',
      fileName: null,
      fileSize: null,
      width: probed.width,
      height: probed.height,
      hasAudio: probed.hasAudio,
      hasVideo: probed.hasVideo,
      channel: probed.channel,
      authorUrl: probed.authorUrl,
      storedPath: null,
    };
  },
};
