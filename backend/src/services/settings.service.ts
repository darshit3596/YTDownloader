import { config } from '../config';
import { prisma } from '../database/prisma';
import type { SettingsInput } from '../validation/schemas';
import type { AudioQuality, VideoQuality } from '../validation/schemas';

export interface AppSettings {
  ffmpegPath: string;
  downloadDir: string;
  maxConcurrentJobs: number;
  autoCleanupHours: number;
  keepOriginalUploads: boolean;
  defaultAudioQuality: AudioQuality;
  defaultVideoQuality: VideoQuality;
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: AppSettings = {
  ffmpegPath: config.ffmpegPath ?? '',
  downloadDir: '',
  maxConcurrentJobs: config.defaults.maxConcurrentJobs,
  autoCleanupHours: config.defaults.autoCleanupHours,
  keepOriginalUploads: false,
  defaultAudioQuality: '320',
  defaultVideoQuality: '1080',
  theme: 'dark',
};

function serialize(key: keyof AppSettings, value: AppSettings[keyof AppSettings]): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function deserialize<K extends keyof AppSettings>(key: K, raw: string): AppSettings[K] {
  const fallback = DEFAULT_SETTINGS[key];
  if (typeof fallback === 'number') {
    const parsed = Number(raw);
    return (Number.isFinite(parsed) ? parsed : fallback) as AppSettings[K];
  }
  if (typeof fallback === 'boolean') return (raw === 'true') as AppSettings[K];
  return (raw || fallback) as AppSettings[K];
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    const raw = map.get(key);
    if (raw !== undefined) {
      // @ts-expect-error — runtime coercion is validated by key-specific fallback types.
      result[key] = deserialize(key, raw);
    }
  }
  return result;
}

export async function updateSettings(input: SettingsInput): Promise<AppSettings> {
  const entries = Object.entries(input) as [keyof AppSettings, AppSettings[keyof AppSettings]][];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: serialize(key, value) },
      update: { value: serialize(key, value) },
    });
  }
  return getSettings();
}
