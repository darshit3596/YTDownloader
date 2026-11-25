import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../utils/logger';
import { MP4_CRF, VIDEO_TARGET_HEIGHTS } from './output-options.service';

const logger = createLogger('ffmpeg');

export interface ToolInfo {
  available: boolean;
  version: string | null;
  path: string | null;
}

interface ToolPaths {
  ffmpeg: string;
  ffprobe: string;
}

function normalizeBinary(candidate: string | null | undefined, binaryName: string): string | null {
  if (!candidate) return null;
  try {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      const win = process.platform === 'win32';
      return path.join(candidate, 'bin', win ? `${binaryName}.exe` : binaryName);
    }
    return candidate;
  } catch {
    return candidate;
  }
}

let configuredFfmpegPath: string | undefined;

export function setConfiguredFfmpegPath(ffmpegPath?: string | null): void {
  const normalized = ffmpegPath?.trim() || undefined;
  if (normalized !== configuredFfmpegPath) {
    configuredFfmpegPath = normalized;
    statusCache = null;
  }
}

export function resolveToolPaths(customFfmpegPath?: string): ToolPaths {
  const custom = customFfmpegPath?.trim() || configuredFfmpegPath || config.ffmpegPath;
  const ffmpeg =
    normalizeBinary(custom, 'ffmpeg') ?? normalizeBinary(ffmpegStatic, 'ffmpeg') ?? 'ffmpeg';

  let ffprobe: string | null = null;
  if (config.ffprobePath) {
    ffprobe = normalizeBinary(config.ffprobePath, 'ffprobe');
  } else if (custom) {
    const directory = path.dirname(ffmpeg);
    const sibling = path.join(
      directory,
      process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe',
    );
    if (fs.existsSync(sibling)) ffprobe = sibling;
  }
  if (!ffprobe) {
    const staticPath = (ffprobeStatic as unknown as { path?: string }).path;
    ffprobe = normalizeBinary(staticPath, 'ffprobe') ?? 'ffprobe';
  }

  return { ffmpeg, ffprobe };
}

let statusCache: { ffmpeg: ToolInfo; ffprobe: ToolInfo; ffmpegPath: string } | null = null;
let statusCacheKey: string | undefined;

async function checkTool(binary: string): Promise<ToolInfo> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (info: ToolInfo) => {
      if (settled) return;
      settled = true;
      resolve(info);
    };

    try {
      const child = spawn(binary, ['-version'], { windowsHide: true });
      let output = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        done({ available: false, version: null, path: binary });
      }, 8000);

      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.on('error', () => {
        clearTimeout(timer);
        done({ available: false, version: null, path: binary });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          const firstLine = output.split('\n')[0]?.trim() ?? '';
          const version = firstLine.match(/version\s+([^\s]+)/i)?.[1] ?? firstLine.slice(0, 80);
          done({ available: true, version, path: binary });
        } else {
          done({ available: false, version: null, path: binary });
        }
      });
    } catch {
      done({ available: false, version: null, path: binary });
    }
  });
}

export async function getToolStatus(customFfmpegPath?: string, force = false) {
  const cacheKey = customFfmpegPath?.trim() || configuredFfmpegPath || config.ffmpegPath || '';
  if (statusCache && !force && statusCacheKey === cacheKey) return statusCache;
  const paths = resolveToolPaths(customFfmpegPath);
  const [ffmpeg, ffprobe] = await Promise.all([
    checkTool(paths.ffmpeg),
    checkTool(paths.ffprobe),
  ]);
  statusCache = { ffmpeg, ffprobe, ffmpegPath: paths.ffmpeg };
  statusCacheKey = cacheKey;
  if (!ffmpeg.available || !ffprobe.available) {
    logger.warn('media tooling unavailable', {
      ffmpeg: ffmpeg.available,
      ffprobe: ffprobe.available,
      paths,
    });
  } else {
    logger.info('media tooling ready', { ffmpeg: ffmpeg.version, ffprobe: ffprobe.version });
  }
  return statusCache;
}

async function assertTool(binary: string, name: string): Promise<void> {
  if (fs.existsSync(binary)) return;
  const status = await checkTool(binary);
  if (!status.available) {
    throw new AppError(
      503,
      'FFMPEG_UNAVAILABLE',
      `${name} is not available on the server. Install it or configure its path in .env.`,
    );
  }
}

export interface MediaProbe {
  duration: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  mimeType: string;
  formatName: string | null;
  bitRate: number | null;
  title: string | null;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    size?: string;
    bit_rate?: string;
    format_name?: string;
    tags?: Record<string, string>;
  };
}

function guessMime(formatName: string | null, hasVideo: boolean): string {
  const name = (formatName ?? '').toLowerCase();
  if (name.includes('mp4') || name.includes('mov')) return 'video/mp4';
  if (name.includes('webm')) return 'video/webm';
  if (name.includes('matroska')) return 'video/x-matroska';
  if (name.includes('avi')) return 'video/x-msvideo';
  if (name.includes('mpeg') && !name.includes('mp3')) return 'video/mpeg';
  if (name.includes('mp3')) return 'audio/mpeg';
  if (name.includes('wav')) return 'audio/wav';
  if (name.includes('flac')) return 'audio/flac';
  if (name.includes('ogg')) return 'audio/ogg';
  if (name.includes('aac')) return 'audio/aac';
  return hasVideo ? 'video/mp4' : 'audio/mpeg';
}

export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const { ffprobe } = resolveToolPaths();
  await assertTool(ffprobe, 'FFprobe');

  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      let child: ChildProcess;
      try {
        child = spawn(
          ffprobe,
          [
            '-v',
            'error',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            '-i',
            filePath,
          ],
          { windowsHide: true },
        );
      } catch {
        resolve({ code: 1, stdout: '', stderr: 'Failed to spawn ffprobe' });
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
        resolve({ code: 1, stdout: '', stderr: error.message });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
    },
  );

  if (result.code !== 0 || !result.stdout.trim()) {
    logger.warn('ffprobe failed', { filePath, stderr: result.stderr.slice(0, 500) });
    throw new AppError(
      422,
      'UNPROBEABLE_MEDIA',
      'The file could not be read as a supported audio or video file.',
    );
  }

  let parsed: FfprobeResult;
  try {
    parsed = JSON.parse(result.stdout) as FfprobeResult;
  } catch {
    throw new AppError(422, 'UNPROBEABLE_MEDIA', 'The media metadata could not be parsed.');
  }

  const streams = parsed.streams ?? [];

  // Reject non-media containers outright. FFprobe happily "detects" a plain
  // text file as a `tty` video with terminal dimensions, so trusting stream
  // flags alone would let non-media files through.
  const formatNames = (parsed.format?.format_name ?? '').split(',').filter(Boolean);
  const nonMediaFormats = new Set([
    'tty',
    'txt',
    'srt',
    'ass',
    'ssa',
    'webvtt',
    'microdvd',
    'subviewer',
    'subviewer1',
    'jacosub',
    'sami',
    'realtext',
    'mpl2',
    'pjs',
    'vplayer',
    'lrc',
    'ffmetadata',
    'concat',
    'image2',
    'gif_pipe',
  ]);
  if (formatNames.length === 0 || formatNames.some((name) => nonMediaFormats.has(name))) {
    throw new AppError(422, 'UNPROBEABLE_MEDIA', 'The file is not a supported audio or video file.');
  }

  const audioStream = streams.find((stream) => stream.codec_type === 'audio');
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const hasAudio = Boolean(audioStream);
  const hasVideo = Boolean(videoStream);

  if (!hasAudio && !hasVideo) {
    throw new AppError(
      422,
      'NO_MEDIA_STREAMS',
      'The file does not contain an audio or video stream.',
    );
  }

  const rawDuration =
    parsed.format?.duration ?? videoStream?.duration ?? audioStream?.duration ?? null;
  const duration = rawDuration ? Number.parseFloat(rawDuration) : null;
  const bitRate = parsed.format?.bit_rate ? Number.parseInt(parsed.format.bit_rate, 10) : null;

  return {
    duration: duration && Number.isFinite(duration) ? duration : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    hasAudio,
    hasVideo,
    mimeType: guessMime(parsed.format?.format_name ?? null, hasVideo),
    formatName: parsed.format?.format_name ?? null,
    bitRate: bitRate && Number.isFinite(bitRate) ? bitRate : null,
    title: parsed.format?.tags?.title ?? null,
  };
}

export interface ConversionParams {
  inputPath: string;
  outputPath: string;
  format: 'mp3' | 'mp4';
  quality: string;
  duration: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

export function buildConversionArgs(params: ConversionParams): string[] {
  const base = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-i',
    params.inputPath,
  ];

  if (params.format === 'mp3') {
    const bitrate = /^(128|192|256|320)$/.test(params.quality) ? params.quality : '320';
    return [
      ...base,
      '-vn',
      '-sn',
      '-dn',
      '-map',
      '0:a:0',
      '-c:a',
      'libmp3lame',
      '-b:a',
      `${bitrate}k`,
      '-id3v2_version',
      '3',
      '-write_id3v1',
      '1',
      '-map_metadata',
      '0',
      '-progress',
      'pipe:1',
      '-nostats',
      params.outputPath,
    ];
  }

  const targetHeight = VIDEO_TARGET_HEIGHTS[params.quality] ?? 720;
  const crf = MP4_CRF[params.quality] ?? 23;
  const args = [
    ...base,
    '-map',
    '0:v:0',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-vf',
    `scale=-2:${targetHeight}:flags=lanczos`,
    '-sn',
    '-dn',
    '-map_metadata',
    '0',
  ];

  if (params.hasAudio) {
    args.push('-map', '0:a:0?', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-an');
  }

  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', params.outputPath);
  return args;
}

export interface ConversionProgress {
  percent: number;
  bytes: number | null;
  speed: number | null;
  etaSeconds: number | null;
}

export interface ConversionResult {
  cancelled: boolean;
  timedOut: boolean;
  stderr: string;
  code: number | null;
}

export interface ConversionHandle {
  promise: Promise<ConversionResult>;
  cancel: () => void;
}

/**
 * Spawns FFmpeg with an argument array (never a shell string) and parses
 * `-progress pipe:1` output into real progress metrics.
 */
export function startConversion(
  params: ConversionParams,
  onProgress: (progress: ConversionProgress) => void,
): ConversionHandle {
  const paths = resolveToolPaths();
  const args = buildConversionArgs(params);

  let cancelled = false;
  let timedOut = false;
  let child: ChildProcess | null = null;

  const promise = new Promise<ConversionResult>((resolve) => {
    try {
      child = spawn(paths.ffmpeg, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        cancelled: false,
        timedOut: false,
        stderr: error instanceof Error ? error.message : 'Failed to spawn FFmpeg',
        code: 1,
      });
      return;
    }

    const startedAt = Date.now();
    let stdoutBuffer = '';
    let stderr = '';
    let microseconds = 0;
    let totalBytes: number | null = null;
    let speedMultiplier: number | null = null;
    let lastEmit = 0;
    let lastSampleTime = startedAt;
    let lastSampleBytes = 0;
    let measuredSpeed: number | null = null;

    const timeout = setTimeout(() => {
      timedOut = true;
      child?.kill('SIGKILL');
    }, config.limits.ffmpegTimeoutMs);

    const emitProgress = (force = false) => {
      const now = Date.now();
      if (!force && now - lastEmit < 450) return;
      lastEmit = now;

      if (totalBytes !== null) {
        const elapsed = (now - lastSampleTime) / 1000;
        if (elapsed >= 0.4 && totalBytes >= lastSampleBytes) {
          const instantaneous = (totalBytes - lastSampleBytes) / elapsed;
          measuredSpeed =
            measuredSpeed === null ? instantaneous : measuredSpeed * 0.6 + instantaneous * 0.4;
          lastSampleTime = now;
          lastSampleBytes = totalBytes;
        }
      }

      const fraction =
        params.duration && params.duration > 0
          ? Math.min(0.99, microseconds / 1_000_000 / params.duration)
          : null;
      const elapsed = (now - startedAt) / 1000;
      const etaSeconds =
        fraction && fraction > 0.01 ? Math.max(0, elapsed / fraction - elapsed) : null;

      onProgress({
        percent: fraction !== null ? Math.min(99, fraction * 100) : 0,
        bytes: totalBytes,
        speed: measuredSpeed,
        etaSeconds,
      });
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const [rawKey, rawValue] = line.trim().split('=');
        if (!rawKey || rawValue === undefined) continue;
        const key = rawKey.trim();
        const value = rawValue.trim();
        if (key === 'out_time_us' || key === 'out_time_ms') {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed) && parsed >= 0) microseconds = parsed;
        } else if (key === 'total_size') {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed) && parsed >= 0) totalBytes = parsed;
        } else if (key === 'speed') {
          const parsed = Number.parseFloat(value.replace('x', ''));
          if (Number.isFinite(parsed)) speedMultiplier = parsed;
        } else if (key === 'progress' && value === 'end') {
          emitProgress(true);
        }
      }
      emitProgress();
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 12_000) stderr = stderr.slice(-6000);
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        cancelled,
        timedOut,
        stderr: error.message,
        code: 1,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (speedMultiplier !== null) {
        logger.debug('ffmpeg finished', { code, speedMultiplier });
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
