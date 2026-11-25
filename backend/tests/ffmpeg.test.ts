import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildConversionArgs,
  getToolStatus,
  probeMedia,
  resolveToolPaths,
  startConversion,
} from '../src/services/ffmpeg.service';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediaflow-ffmpeg-test-'));
const sourcePath = path.join(workDir, 'source.mp4');
const longSourcePath = path.join(workDir, 'long.mp4');

function runFfmpeg(args: string[]): void {
  const { ffmpeg } = resolveToolPaths();
  const result = spawnSync(ffmpeg, args, { windowsHide: true, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr}`);
  }
}

beforeAll(() => {
  runFfmpeg([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=640x480:rate=15',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=44100',
    '-t',
    '2',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    sourcePath,
  ]);

  runFfmpeg([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x480:rate=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=220:sample_rate=44100',
    '-t',
    '25',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    longSourcePath,
  ]);
});

afterAll(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('tool discovery', () => {
  it('finds bundled ffmpeg and ffprobe', async () => {
    const status = await getToolStatus();
    expect(status.ffmpeg.available).toBe(true);
    expect(status.ffprobe.available).toBe(true);
    expect(status.ffmpeg.path).toBeTruthy();
  });
});

describe('probeMedia', () => {
  it('reads streams, dimensions and duration', async () => {
    const probe = await probeMedia(sourcePath);
    expect(probe.hasAudio).toBe(true);
    expect(probe.hasVideo).toBe(true);
    expect(probe.width).toBe(640);
    expect(probe.height).toBe(480);
    expect(probe.duration).toBeGreaterThan(1.5);
    expect(probe.mimeType).toContain('video/');
  });

  it('rejects non-media files with a clear error', async () => {
    const textPath = path.join(workDir, 'notes.txt');
    fs.writeFileSync(textPath, 'this is definitely not a video');
    await expect(probeMedia(textPath)).rejects.toMatchObject({ code: 'UNPROBEABLE_MEDIA' });
  });
});

describe('buildConversionArgs', () => {
  const params = {
    inputPath: sourcePath,
    outputPath: path.join(workDir, 'out.mp3'),
    format: 'mp3' as const,
    quality: '192',
    duration: 2,
    hasAudio: true,
    hasVideo: true,
  };

  it('builds MP3 arguments with an explicit bitrate', () => {
    const args = buildConversionArgs(params);
    expect(args).toContain('libmp3lame');
    expect(args).toContain('-vn');
    expect(args[args.indexOf('-b:a') + 1]).toBe('192k');
    expect(args).toContain('-progress');
    expect(args).not.toContain('shell');
  });

  it('builds MP4 arguments with scaling and audio mapping', () => {
    const args = buildConversionArgs({ ...params, format: 'mp4', quality: '360', outputPath: 'out.mp4' });
    expect(args).toContain('libx264');
    const filter = args[args.indexOf('-vf') + 1];
    expect(filter).toContain('scale=-2:360');
    expect(args).toContain('+faststart');
    expect(args).toContain('-c:a');
  });

  it('omits audio for silent video sources', () => {
    const args = buildConversionArgs({
      ...params,
      format: 'mp4',
      quality: '720',
      hasAudio: false,
      outputPath: 'out.mp4',
    });
    expect(args).toContain('-an');
    expect(args).not.toContain('-c:a');
  });
});

describe('real conversion', () => {
  it('converts a video to MP3 and reports progress', async () => {
    const outputPath = path.join(workDir, 'audio.mp3');
    const progress: number[] = [];
    const handle = startConversion(
      {
        inputPath: sourcePath,
        outputPath,
        format: 'mp3',
        quality: '128',
        duration: 2,
        hasAudio: true,
        hasVideo: true,
      },
      (update) => progress.push(update.percent),
    );

    const result = await handle.promise;
    expect(result.code).toBe(0);
    expect(result.cancelled).toBe(false);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(1000);

    const probe = await probeMedia(outputPath);
    expect(probe.hasAudio).toBe(true);
    expect(probe.hasVideo).toBe(false);
    expect(progress.length).toBeGreaterThan(0);
    expect(Math.max(...progress)).toBeLessThanOrEqual(100);
  });

  it('converts a video to MP4 at the requested height', async () => {
    const outputPath = path.join(workDir, 'video.mp4');
    const handle = startConversion(
      {
        inputPath: sourcePath,
        outputPath,
        format: 'mp4',
        quality: '360',
        duration: 2,
        hasAudio: true,
        hasVideo: true,
      },
      () => undefined,
    );

    const result = await handle.promise;
    expect(result.code).toBe(0);
    const probe = await probeMedia(outputPath);
    expect(probe.hasVideo).toBe(true);
    expect(probe.hasAudio).toBe(true);
    expect(probe.height).toBe(360);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(1000);
  });

  it('cancels a running conversion and stops the process', async () => {
    const outputPath = path.join(workDir, 'cancelled.mp4');
    const handle = startConversion(
      {
        inputPath: longSourcePath,
        outputPath,
        format: 'mp4',
        quality: '480',
        duration: 25,
        hasAudio: true,
        hasVideo: true,
      },
      () => undefined,
    );

    setTimeout(() => handle.cancel(), 250);
    const result = await handle.promise;
    expect(result.cancelled).toBe(true);
  });
});
