#!/usr/bin/env node
/**
 * End-to-end smoke test against a running MediaFlow API.
 *
 * Usage:
 *   node scripts/smoke-test.mjs [path-to-sample-video]
 *
 * Defaults to storage/temp/long.mp4. Generate one with:
 *   ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=330 \
 *     -t 45 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac storage/temp/long.mp4
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4000';
const API = `${BASE}/api`;
const samplePath = path.resolve(process.argv[2] ?? 'storage/temp/long.mp4');

let failures = 0;
let checks = 0;

function check(name, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name} ${detail ? `— ${detail}` : ''}`);
  }
}

async function jsonRequest(method, endpoint, body) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data, headers: response.headers };
}

async function pollJob(id, timeoutMs = 120_000) {
  return waitForJob(id, (job) => ['completed', 'failed', 'cancelled'].includes(job.status), timeoutMs);
}

async function waitForJob(id, predicate, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const { status, data } = await jsonRequest('GET', `/jobs/${id}`);
    if (status === 200) {
      last = data;
      if (predicate(data)) return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return last;
}

async function main() {
  console.log(`\nMediaFlow smoke test → ${BASE}\n`);

  const health = await jsonRequest('GET', '/health');
  check('health endpoint responds ok', health.status === 200 && health.data?.ok === true);

  const system = await jsonRequest('GET', '/system/status');
  check('ffmpeg detected', system.data?.ffmpeg?.available === true);
  check('ffprobe detected', system.data?.ffprobe?.available === true);

  console.log('\n[security] URL validation / SSRF');
  for (const url of [
    'http://127.0.0.1:4000/api/health',
    'http://localhost:4000/',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5/video.mp4',
    'file:///C:/Windows/win.ini',
  ]) {
    const result = await jsonRequest('POST', '/media/analyze', { url });
    check(`blocks ${url}`, result.status === 400, `got ${result.status}`);
  }

  const youtube = await jsonRequest('POST', '/media/analyze', {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
  check(
    'YouTube metadata without API key returns a clear 503',
    youtube.status === 503 && youtube.data?.error?.code === 'YOUTUBE_NOT_CONFIGURED',
    JSON.stringify(youtube.data),
  );

  console.log('\n[settings]');
  const settingsBefore = await jsonRequest('GET', '/settings');
  check('settings load', settingsBefore.status === 200 && settingsBefore.data?.maxConcurrentJobs >= 1);
  const settingsUpdate = await jsonRequest('PUT', '/settings', { autoCleanupHours: 48 });
  check('settings update persists', settingsUpdate.data?.autoCleanupHours === 48);
  await jsonRequest('PUT', '/settings', {
    autoCleanupHours: settingsBefore.data?.autoCleanupHours ?? 24,
  });
  const badSettings = await jsonRequest('PUT', '/settings', { maxConcurrentJobs: 99 });
  check('invalid settings rejected', badSettings.status === 400);

  console.log('\n[upload]');
  const stat = await fs.stat(samplePath).catch(() => null);
  if (!stat) throw new Error(`Sample video not found at ${samplePath}`);
  const form = new FormData();
  form.append(
    'file',
    new Blob([await fs.readFile(samplePath)], { type: 'video/mp4' }),
    path.basename(samplePath),
  );
  const uploadResponse = await fetch(`${API}/media/upload`, { method: 'POST', body: form });
  const media = await uploadResponse.json();
  check('upload accepted', uploadResponse.status === 201 && Boolean(media.id), JSON.stringify(media));
  check('ffprobe read dimensions', media.width > 0 && media.height > 0);
  check('output matrix includes MP3', media.outputOptions?.some((o) => o.format === 'mp3' && o.available));
  check(
    'upscaling is disabled above source height',
    media.outputOptions?.filter((o) => o.format === 'mp4' && o.quality === '4k')?.[0]?.available === false,
  );

  const badUpload = new FormData();
  badUpload.append('file', new Blob(['not media']), 'notes.txt');
  const badUploadResponse = await fetch(`${API}/media/upload`, { method: 'POST', body: badUpload });
  check('non-media upload rejected', badUploadResponse.status === 400);

  console.log('\n[duplicate detection]');
  const firstJob = await jsonRequest('POST', '/conversions', {
    mediaId: media.id,
    outputFormat: 'mp3',
    quality: '128',
    fileName: 'Smoke Audio',
  });
  check('MP3 job queued', firstJob.status === 201);
  const duplicate = await jsonRequest('POST', '/conversions', {
    mediaId: media.id,
    outputFormat: 'mp3',
    quality: '128',
    fileName: 'Smoke Audio 2',
  });
  check(
    'duplicate active job rejected',
    duplicate.status === 409 && duplicate.data?.error?.code === 'DUPLICATE_JOB',
    JSON.stringify(duplicate.data),
  );

  console.log('\n[cancel + retry]');
  const slowJob = await jsonRequest('POST', '/conversions', {
    mediaId: media.id,
    outputFormat: 'mp4',
    quality: '1080',
    fileName: 'Smoke Cancel',
  });
  check('slow 1080p job created', slowJob.status === 201, JSON.stringify(slowJob.data));
  const started = await waitForJob(slowJob.data.id, (job) => job.status === 'processing', 60_000);
  check('job reached processing', started?.status === 'processing', `last=${started?.status}`);
  const cancel = await jsonRequest('POST', `/jobs/${slowJob.data.id}/cancel`);
  check(
    'processing job cancelled',
    cancel.status === 200 && cancel.data?.status === 'cancelled',
    JSON.stringify(cancel.data),
  );
  const retried = await jsonRequest('POST', `/jobs/${slowJob.data.id}/retry`);
  check(
    'cancelled job retried',
    retried.status === 200 && retried.data?.status === 'queued',
    JSON.stringify(retried.data),
  );
  const retryDone = await pollJob(slowJob.data.id, 300_000);
  check('retried job completed after cancel', retryDone.status === 'completed', retryDone.errorMessage ?? '');
  check('retried output has bytes', retryDone.fileSize > 0);

  console.log('\n[mp3 conversion]');
  const completed = await pollJob(firstJob.data.id);
  check('MP3 completed', completed.status === 'completed', completed.errorMessage ?? '');
  check('MP3 output has bytes', completed.fileSize > 0);
  check('progress reached 100', completed.progress === 100);

  console.log('\n[download]');
  const download = await fetch(`${API}/downloads/${completed.id}`);
  const downloaded = await download.arrayBuffer();
  check('download responds 200', download.status === 200);
  check('download content type is audio/mpeg', download.headers.get('content-type')?.includes('audio/mpeg'));
  check('downloaded bytes match job size', downloaded.byteLength === completed.fileSize);
  check(
    'content disposition is an attachment',
    download.headers.get('content-disposition')?.includes('attachment') === true,
  );

  const range = await fetch(`${API}/downloads/${completed.id}`, {
    headers: { Range: 'bytes=0-99' },
  });
  const rangeBytes = await range.arrayBuffer();
  check('range request returns 206', range.status === 206);
  check('range returns 100 bytes', rangeBytes.byteLength === 100);

  console.log('\n[mp4 conversion]');
  const mp4Job = await jsonRequest('POST', '/conversions', {
    mediaId: media.id,
    outputFormat: 'mp4',
    quality: '720',
    fileName: 'Smoke Video',
  });
  check('MP4 job created', mp4Job.status === 201);
  const mp4Done = await pollJob(mp4Job.data.id, 180_000);
  check('MP4 completed', mp4Done.status === 'completed', mp4Done.errorMessage ?? '');
  check('MP4 output has bytes', mp4Done.fileSize > 0);
  const mp4Download = await fetch(`${API}/downloads/${mp4Done.id}`);
  check('MP4 content type', mp4Download.headers.get('content-type')?.includes('video/mp4'));

  console.log('\n[history]');
  const history = await jsonRequest('GET', '/history');
  check('history lists completed jobs', Array.isArray(history.data) && history.data.length >= 2);
  const mp3Entry = history.data.find((entry) => entry.jobId === completed.id);
  check('history entry exists for MP3 job', Boolean(mp3Entry));
  if (mp3Entry) {
    const deleted = await jsonRequest('DELETE', `/history/${mp3Entry.id}`);
    check('history entry deleted', deleted.status === 200 && deleted.data?.deleted === true);
    const jobAfter = await jsonRequest('GET', `/jobs/${completed.id}`);
    check('download removed after history delete', jobAfter.data?.fileAvailable === false);
    const gone = await fetch(`${API}/downloads/${completed.id}`);
    check('download endpoint returns 404 for removed file', gone.status === 404);
  }

  console.log(`\n${failures === 0 ? '✅' : '❌'} ${checks - failures}/${checks} checks passed\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error.message);
  process.exit(1);
});
