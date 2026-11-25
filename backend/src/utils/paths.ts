import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config';

export const storageRoot =
  config.storageRoot ?? path.resolve(__dirname, '../../../storage');

export const storagePaths = {
  root: storageRoot,
  uploads: path.join(storageRoot, 'uploads'),
  downloads: path.join(storageRoot, 'downloads'),
  temp: path.join(storageRoot, 'temp'),
};

for (const directory of Object.values(storagePaths)) {
  fs.mkdirSync(directory, { recursive: true });
}

let customDownloadDir: string | undefined;

export function setConfiguredDownloadDir(dir?: string | null): void {
  const trimmed = dir?.trim();
  if (!trimmed) {
    customDownloadDir = undefined;
    return;
  }
  const resolved = path.resolve(trimmed);
  fs.mkdirSync(resolved, { recursive: true });
  customDownloadDir = resolved;
}

export function getDownloadsDir(): string {
  return customDownloadDir ?? storagePaths.downloads;
}

/** True when `child` is strictly inside `parent` (path-traversal safe). */
export function isPathInside(child: string, parent: string): boolean {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  const relative = path.relative(resolvedParent, resolvedChild);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return true;
}

export function assertPathInside(child: string, parent: string): string {
  if (!isPathInside(child, parent)) {
    throw new Error('Resolved path escapes the allowed storage directory');
  }
  return path.resolve(child);
}

export function ensureDirectory(directory: string): string {
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export async function directorySize(directory: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isFile()) {
        total += (await fs.promises.stat(full)).size;
      } else if (entry.isDirectory()) {
        total += await directorySize(full);
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function safeUnlink(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // File already gone — nothing to do.
  }
}
