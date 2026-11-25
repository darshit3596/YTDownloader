import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  HardDrive,
  ListChecks,
  Loader2,
  Moon,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api, getErrorMessage } from '@/services/api';
import { useThemeStore } from '@/store/theme-store';
import { toast } from '@/store/toast-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSystemStatus } from '@/hooks/use-system-status';
import { cn, formatBytes } from '@/lib/utils';
import type { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
  ffmpegPath: '',
  downloadDir: '',
  maxConcurrentJobs: 1,
  autoCleanupHours: 24,
  keepOriginalUploads: false,
  defaultAudioQuality: '320',
  defaultVideoQuality: '1080',
  theme: 'dark',
};

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  action,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/50">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/60 text-primary">
            <Icon className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setGlobalSettings = useSettingsStore((s) => s.setSettings);
  const { status, loading: statusLoading, refresh, error: statusError } = useSystemStatus();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .settings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setSaved(data);
        if (data.theme && data.theme !== theme) setTheme(data.theme);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        theme: settings.theme,
        downloadDir: settings.downloadDir ?? '',
        defaultAudioQuality: settings.defaultAudioQuality,
        defaultVideoQuality: settings.defaultVideoQuality,
        maxConcurrentJobs: 1,
      });
      setSettings(updated);
      setSaved(updated);
      setGlobalSettings(updated);
      setTheme(updated.theme);
      toast.success('Settings saved', 'Your default quality and theme are updated.');
      void refresh();
    } catch (err) {
      toast.error('Could not save settings', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const totalStorage =
    (status?.storage.uploads ?? 0) +
    (status?.storage.downloads ?? 0) +
    (status?.storage.temp ?? 0);

  const engineReady = Boolean(status?.ffmpeg.available && status?.ffprobe.available);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Choose your default download quality, theme, and check app status."
        actions={
          <Button
            size="sm"
            variant={dirty ? 'default' : 'outline'}
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!dirty && !saving}
          >
            {!saving && <Save className="size-3.5" />}
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        }
      />

      {loadError && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading settings…
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <SettingsCard
            icon={Palette}
            title="Appearance"
            description="Choose dark or light mode for the app."
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(['dark', 'light'] as const).map((option) => {
                const active = theme === option;
                const Icon = option === 'dark' ? Moon : Sun;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setTheme(option);
                      update('theme', option);
                    }}
                    className={cn(
                      'relative overflow-hidden rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-primary/50 bg-primary/[0.06] ring-1 ring-primary/25'
                        : 'border-border/70 bg-background/30 hover:border-border',
                    )}
                  >
                    <div
                      className={cn(
                        'mb-3 flex h-14 items-end gap-1.5 rounded-lg border p-2',
                        option === 'dark'
                          ? 'border-white/10 bg-[#070a15]'
                          : 'border-black/10 bg-[#f4f5f9]',
                      )}
                    >
                      <div className={cn('h-2 w-8 rounded-full', option === 'dark' ? 'bg-white/20' : 'bg-black/10')} />
                      <div className="h-2 w-4 rounded-full bg-[#ff2a3c]" />
                      <div className={cn('h-2 flex-1 rounded-full', option === 'dark' ? 'bg-white/10' : 'bg-black/5')} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold capitalize">
                        <Icon className="size-3.5 text-primary" />
                        {option}
                      </span>
                      {active && <Check className="size-3.5 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          <SettingsCard
            icon={SlidersHorizontal}
            title="Default Download Quality"
            description="Used automatically when you don't pick a custom quality on the download screen."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="video-default" className="text-xs">
                  Default Video Quality (MP4)
                </Label>
                <Select
                  id="video-default"
                  className="mt-2 text-[12.5px]"
                  value={settings.defaultVideoQuality}
                  onChange={(event) =>
                    update('defaultVideoQuality', event.target.value as AppSettings['defaultVideoQuality'])
                  }
                >
                  <option value="360">360p (Low data)</option>
                  <option value="480">480p (Standard)</option>
                  <option value="720">720p (HD)</option>
                  <option value="1080">1080p (Full HD)</option>
                  <option value="4k">4K (Ultra HD)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="audio-default" className="text-xs">
                  Default Audio Quality (MP3)
                </Label>
                <Select
                  id="audio-default"
                  className="mt-2 text-[12.5px]"
                  value={settings.defaultAudioQuality}
                  onChange={(event) =>
                    update('defaultAudioQuality', event.target.value as AppSettings['defaultAudioQuality'])
                  }
                >
                  <option value="128">128 kbps (Small file)</option>
                  <option value="192">192 kbps (Good)</option>
                  <option value="256">256 kbps (High)</option>
                  <option value="320">320 kbps (Best)</option>
                </Select>
              </div>
            </div>

            <div className="mt-4 border-t border-border/60 pt-4">
              <Label htmlFor="download-dir" className="text-xs">
                Saved Files Folder Path <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="download-dir"
                className="mt-2 font-mono text-[12px]"
                placeholder="C:\Users\YourName\Downloads — leave blank for default folder"
                value={settings.downloadDir ?? ''}
                onChange={(event) => update('downloadDir', event.target.value)}
                spellCheck={false}
              />
              <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                Downloaded MP4 and MP3 files will be saved in this folder.
              </p>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={ShieldCheck}
            title="App Status"
            description="Simple health check for downloads and storage."
            action={
              <Button variant="ghost" size="icon-sm" onClick={() => void refresh()} aria-label="Refresh status">
                <RefreshCw className={cn('size-3.5', statusLoading && 'animate-spin')} />
              </Button>
            }
          >
            {statusError && (
              <div className="mb-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive">
                {statusError}
              </div>
            )}
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-background/30 px-3.5 py-3">
                <span className="flex items-center gap-2 text-[12.5px]">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  Downloader Engine
                </span>
                {engineReady ? (
                  <Badge variant="success">
                    <Check className="size-3" /> Ready
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="size-3" /> Not ready
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 bg-background/30 px-3.5 py-3">
                <span className="flex items-center gap-2 text-[12.5px]">
                  <ListChecks className="size-4 text-muted-foreground" />
                  Download Queue
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {status?.queue.active ?? 0} downloading · {status?.queue.queued ?? 0} waiting (one by one)
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 bg-background/30 px-3.5 py-3">
                <span className="flex items-center gap-2 text-[12.5px]">
                  <HardDrive className="size-4 text-muted-foreground" />
                  Saved Files Space
                </span>
                <span className="font-mono text-[12px] text-muted-foreground">
                  {totalStorage > 0 ? formatBytes(totalStorage) : '0 B'}
                </span>
              </div>
            </div>
          </SettingsCard>

          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/40 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              {dirty ? 'You have unsaved changes.' : 'All settings are saved.'}
            </p>
            <Button size="sm" onClick={() => void handleSave()} loading={saving} disabled={!dirty && !saving}>
              {!saving && <Save className="size-3.5" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
