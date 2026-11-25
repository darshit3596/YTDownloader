import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AppError } from '../middleware/error-handler';
import { assertSafeUrl } from './network';
import { extensionForMime, isMediaContentType } from './files';
import { createLogger } from './logger';

const logger = createLogger('remote-fetch');
const MAX_REDIRECTS = 5;
const USER_AGENT = 'MediaFlow/1.0 (authorized media conversion workspace)';

export interface RemoteFetchOptions {
  method?: 'GET' | 'HEAD';
  maxBytes?: number;
  idleTimeoutMs?: number;
  headers?: Record<string, string>;
}

export interface RemoteResponse {
  response: Response;
  finalUrl: string;
  abort: () => void;
}

/**
 * Fetch with manual redirect handling so every hop is SSRF-validated.
 * Only public http(s) hosts are reachable.
 */
export async function safeFetch(
  target: string,
  options: RemoteFetchOptions = {},
): Promise<RemoteResponse> {
  const controller = new AbortController();
  const idleTimeoutMs = options.idleTimeoutMs ?? 20_000;
  let idleTimer: NodeJS.Timeout | undefined;

  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
  };

  armIdleTimer();
  let current = target;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertSafeUrl(current);
      let response: Response;
      try {
        response = await fetch(current, {
          method: options.method ?? 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'video/*,audio/*,application/octet-stream;q=0.8,*/*;q=0.5',
            ...options.headers,
          },
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new AppError(504, 'FETCH_TIMEOUT', 'The media host took too long to respond.');
        }
        throw new AppError(502, 'FETCH_FAILED', 'The media host could not be reached.');
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        const location = response.headers.get('location');
        if (!location) {
          throw new AppError(502, 'BAD_REDIRECT', 'The media host returned an invalid redirect.');
        }
        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError(404, 'MEDIA_NOT_FOUND', 'The media file was not found at that URL.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            403,
            'MEDIA_ACCESS_DENIED',
            'The media host denied access. Use a URL you are authorized to fetch.',
          );
        }
        throw new AppError(
          502,
          'MEDIA_HOST_ERROR',
          `The media host responded with HTTP ${response.status}.`,
        );
      }

      return { response, finalUrl: current, abort: () => controller.abort() };
    }

    throw new AppError(400, 'TOO_MANY_REDIRECTS', 'The media URL redirected too many times.');
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
}

export interface DownloadedFile {
  filePath: string;
  contentType: string | null;
  bytes: number;
  finalUrl: string;
  titleHint: string;
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop() ?? 'media';
    return decodeURIComponent(last).replace(/\.[^.]+$/, '') || 'Fetched media';
  } catch {
    return 'Fetched media';
  }
}

/**
 * Streams a remote authorized media file to disk without buffering it in memory.
 * Enforces a byte cap and an idle timeout.
 */
export async function downloadRemoteMedia(
  target: string,
  destinationDir: string,
  maxBytes: number,
  idleTimeoutMs = 60_000,
): Promise<DownloadedFile> {
  const head = await safeFetch(target, { method: 'GET', idleTimeoutMs }).catch((error) => {
    throw error instanceof AppError ? error : new AppError(502, 'FETCH_FAILED', 'Fetch failed.');
  });

  const { response, finalUrl, abort } = head;
  const contentType = response.headers.get('content-type');

  if (!isMediaContentType(contentType)) {
    abort();
    throw new AppError(
      415,
      'UNSUPPORTED_CONTENT_TYPE',
      'That URL does not point directly to a media file. HTML pages, playlists and streaming manifests are not supported.',
      { contentType: contentType ?? 'unknown' },
    );
  }

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    abort();
    throw new AppError(
      413,
      'REMOTE_FILE_TOO_LARGE',
      `The remote file is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    );
  }
  if (!response.body) {
    abort();
    throw new AppError(502, 'EMPTY_RESPONSE', 'The media host returned an empty body.');
  }

  const extension =
    extensionForMime(contentType) ??
    path.extname(new URL(finalUrl).pathname).toLowerCase() ??
    '.bin';
  const safeExtension = /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '.bin';

  const filePath = path.join(destinationDir, `${randomUUID()}${safeExtension}`);
  const writeStream = fs.createWriteStream(filePath);
  let bytes = 0;
  let idleMonitor: NodeJS.Timeout | undefined;
  const resetIdleMonitor = () => {
    if (idleMonitor) clearTimeout(idleMonitor);
    idleMonitor = setTimeout(() => abort(), idleTimeoutMs);
  };
  resetIdleMonitor();

  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      resetIdleMonitor();
      bytes += chunk.length;
      if (bytes > maxBytes) {
        callback(
          new AppError(
            413,
            'REMOTE_FILE_TOO_LARGE',
            `The download exceeded the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
          ),
        );
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body as never), meter, writeStream);
  } catch (error) {
    abort();
    await fs.promises.unlink(filePath).catch(() => undefined);
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'DOWNLOAD_FAILED', 'The media file could not be downloaded.');
  } finally {
    if (idleMonitor) clearTimeout(idleMonitor);
  }

  const stat = await fs.promises.stat(filePath);
  logger.info('remote media downloaded', { bytes: stat.size, finalUrl });

  return {
    filePath,
    contentType,
    bytes: stat.size,
    finalUrl,
    titleHint: titleFromUrl(finalUrl),
  };
}
