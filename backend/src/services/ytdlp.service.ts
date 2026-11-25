import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../utils/logger';
import {
  resolveToolPaths,
  type ConversionHandle,
  type ConversionProgress,
  type ConversionResult,
} from './ffmpeg.service';
import { VIDEO_TARGET_HEIGHTS } from './output-options.service';

const logger = createLogger('yt-dlp');

export interface YouTubeProbe {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  channel: string | null;
  authorUrl: string | null;
}

interface YtDlpFormat {
  vcodec?: string;
  acodec?: string;
  width?: number;
  height?: number;
}

interface YtDlpJson {
  title?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
  duration?: number;
  width?: number;
  height?: number;
  channel?: string;
  uploader?: string;
  channel_url?: string;
  uploader_url?: string;
  vcodec?: string;
  acodec?: string;
  formats?: YtDlpFormat[];
}

export function resolveYtDlpPath(): string {
  return config.ytdlpPath || 'yt-dlp';
}

export async function checkYtDlp(): Promise<{ available: boolean; version: string | null }> {
  const binary = resolveYtDlpPath();
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: { available: boolean; version: string | null }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const child = spawn(binary, ['--version'], { windowsHide: true });
      let stdout = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        done({ available: false, version: null });
      }, 8000);
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.on('error', () => {
        clearTimeout(timer);
        done({ available: false, version: null });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        done(
          code === 0
            ? { available: true, version: stdout.trim().split('\n')[0] || 'available' }
            : { available: false, version: null },
        );
      });
    } catch {
      done({ available: false, version: null });
    }
  });
}

export async function probeYouTube(url: string): Promise<YouTubeProbe> {
  const binary = resolveYtDlpPath();
  const args = [
    '--dump-single-json',
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    url,
  ];

  const result = await new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    spawnError?: string;
  }>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(binary, args, { windowsHide: true });
    } catch (error) {
      resolve({
        code: 1,
        stdout: '',
        stderr: '',
        spawnError: error instanceof Error ? error.message : 'Failed to spawn yt-dlp',
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 45_000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: '', stderr: error.message, spawnError: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });

  if (result.spawnError && /ENOENT|not recognized/i.test(result.spawnError)) {
    throw new AppError(
      503,
      'YTDLP_UNAVAILABLE',
      'yt-dlp is not installed or not found on PATH. Install yt-dlp or set YTDLP_PATH in backend/.env.',
    );
  }

  if (result.code !== 0 || !result.stdout.trim()) {
    const err = result.stderr.trim();
    logger.warn('yt-dlp probe failed', { url, stderr: err.slice(0, 400) });
    if (/sign in to confirm you.?re not a bot/i.test(err)) {
      throw new AppError(
        403,
        'YOUTUBE_BOT_CHECK',
        "YouTube blocked this request with a 'Sign in to confirm you're not a bot' check.",
      );
    }
    if (/private video|video unavailable|sign in|removed|copyright/i.test(err)) {
      throw new AppError(
        404,
        'YOUTUBE_VIDEO_NOT_FOUND',
        'That video is private, unavailable, or requires sign-in.',
      );
    }
    throw new AppError(
      422,
      'YOUTUBE_PROBE_FAILED',
      err ? err.split('\n').slice(-1)[0].slice(0, 220) : 'Could not analyze that YouTube URL.',
    );
  }

  let data: YtDlpJson;
  try {
    data = JSON.parse(result.stdout) as YtDlpJson;
  } catch {
    throw new AppError(422, 'YOUTUBE_PROBE_FAILED', 'Could not parse YouTube video metadata.');
  }

  const formats = data.formats ?? [];
  let maxWidth: number | null = data.width ?? null;
  let maxHeight: number | null = data.height ?? null;

  for (const fmt of formats) {
    if (fmt.vcodec && fmt.vcodec !== 'none' && fmt.height && fmt.height > (maxHeight ?? 0)) {
      maxHeight = fmt.height;
      maxWidth = fmt.width ?? maxWidth;
    }
  }

  const hasVideo = Boolean((maxHeight && maxHeight > 0) || (data.vcodec && data.vcodec !== 'none'));
  const hasAudio =
    formats.length > 0
      ? formats.some((fmt) => fmt.acodec && fmt.acodec !== 'none')
      : data.acodec !== 'none';

  const thumbnail =
    data.thumbnail ??
    data.thumbnails
      ?.slice()
      .reverse()
      .find((t) => Boolean(t.url))?.url ??
    null;

  return {
    title: data.title?.slice(0, 200) || 'YouTube Video',
    thumbnail,
    duration: typeof data.duration === 'number' && Number.isFinite(data.duration) ? data.duration : null,
    width: maxWidth,
    height: maxHeight,
    hasAudio,
    hasVideo,
    channel: data.channel ?? data.uploader ?? null,
    authorUrl: data.channel_url ?? data.uploader_url ?? null,
  };
}

export interface YouTubeDownloadParams {
  url: string;
  outputPath: string;
  format: 'mp3' | 'mp4';
  quality: string;
}

async function cleanupPartialFiles(outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath, path.extname(outputPath));
  try {
    const entries = await fs.promises.readdir(dir);
    await Promise.all(
      entries
        .filter((name) => name === path.basename(outputPath) || name.startsWith(`${base}.`))
        .map((name) => fs.promises.unlink(path.join(dir, name)).catch(() => undefined)),
    );
  } catch {
    // Ignore cleanup errors.
  }
}

export function startYouTubeDownload(
  params: YouTubeDownloadParams,
  onProgress: (progress: ConversionProgress) => void,
): ConversionHandle {
  const binary = resolveYtDlpPath();
  const { ffmpeg } = resolveToolPaths();
  const outputTemplate = `${params.outputPath.replace(/\.[^.]+$/, '')}.%(ext)s`;

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-part',
    '--newline',
    '--progress',
    '--progress-template',
    'download:%(progress._percent_str)s|%(progress.speed)s|%(progress.eta)s',
    '--ffmpeg-location',
    ffmpeg,
  ];

  if (params.format === 'mp3') {
    const bitrate = /^(128|192|256|320)$/.test(params.quality) ? params.quality : '320';
    args.push(
      '-f',
      'bestaudio/best',
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      `${bitrate}K`,
      '--embed-metadata',
    );
  } else {
    const targetHeight = VIDEO_TARGET_HEIGHTS[params.quality] ?? 720;
    args.push(
      '-f',
      `bestvideo[height<=${targetHeight}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${targetHeight}]+bestaudio/best[height<=${targetHeight}]/best`,
      '--merge-output-format',
      'mp4',
    );
  }

  args.push('-o', outputTemplate, params.url);

  let cancelled = false;
  let timedOut = false;
  let child: ChildProcess | null = null;

  const promise = new Promise<ConversionResult>((resolve) => {
    try {
      child = spawn(binary, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        cancelled: false,
        timedOut: false,
        stderr: error instanceof Error ? error.message : 'Failed to spawn yt-dlp',
        code: 1,
      });
      return;
    }

    let stdoutBuffer = '';
    let stderr = '';
    let lastEmit = 0;

    const timeout = setTimeout(() => {
      timedOut = true;
      child?.kill('SIGKILL');
    }, config.limits.ffmpegTimeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.includes('|')) continue;
        const [rawPct, rawSpeed, rawEta] = trimmed.split('|');
        const pct = Number.parseFloat((rawPct ?? '').replace('%', '').trim());
        const speed = Number.parseFloat((rawSpeed ?? '').trim());
        const eta = Number.parseFloat((rawEta ?? '').trim());

        const now = Date.now();
        if (Number.isFinite(pct) && now - lastEmit >= 350) {
          lastEmit = now;
          onProgress({
            percent: Math.min(99, Math.max(0, pct)),
            bytes: null,
            speed: Number.isFinite(speed) ? speed : null,
            etaSeconds: Number.isFinite(eta) ? eta : null,
          });
        }
      }
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 12_000) stderr = stderr.slice(-6000);
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      void cleanupPartialFiles(params.outputPath).then(() =>
        resolve({
          cancelled,
          timedOut,
          stderr: error.message,
          code: 1,
        }),
      );
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (cancelled || timedOut || code !== 0) {
        void cleanupPartialFiles(params.outputPath).then(() =>
          resolve({ cancelled, timedOut, stderr: stderr.trim(), code }),
        );
        return;
      }
      resolve({ cancelled, timedOut, stderr: stderr.trim(), code });
    });
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      try {
        child?.kill('SIGKILL');
      } catch {
        // Already exited.
      }
    },
  };
}
