import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Copy,
  Download,
  Film,
  FolderOpen,
  Link2,
  Loader2,
  Play,
  Star,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PlayerModal, type PlayableMedia } from '@/components/media/player-modal';
import { api, getErrorMessage } from '@/services/api';
import { useJobStore } from '@/store/job-store';
import { useSettingsStore } from '@/store/settings-store';
import { toast } from '@/store/toast-store';
import { validateMediaUrl } from '@/lib/validation';
import { cn, formatBytes, formatDuration, formatEta, formatSpeed } from '@/lib/utils';
import type { OutputFormat } from '@/types';

const MP4_QUALITIES = [
  { value: '1080', label: 'Best Quality (1080p)' },
  { value: '4k', label: 'Ultra HD (4K)' },
  { value: '720', label: 'HD (720p)' },
  { value: '480', label: 'SD (480p)' },
  { value: '360', label: 'Mobile (360p)' },
] as const;

const MP3_QUALITIES = [
  { value: '320', label: 'Best Quality (320 kbps)' },
  { value: '256', label: 'High (256 kbps)' },
  { value: '192', label: 'Balanced (192 kbps)' },
  { value: '128', label: 'Compact (128 kbps)' },
] as const;

const FEATURES = [
  'Download Videos & Audio',
  'Multiple Quality Options',
  'High Speed Download',
  'Clean & Modern UI',
  '100% Free & Local',
];

const LAST_FORMAT_KEY = 'mediaflow:lastFormat';
const LAST_QUALITY_KEY = 'mediaflow:lastQuality';

export function DownloaderPage() {
  const settings = useSettingsStore((s) => s.settings);
  const jobs = useJobStore((s) => s.jobs);
  const upsertJob = useJobStore((s) => s.upsertJob);

  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<OutputFormat>(() => {
    const saved = localStorage.getItem(LAST_FORMAT_KEY);
    return saved === 'mp3' || saved === 'mp4' ? saved : 'mp4';
  });
  const [quality, setQuality] = useState<string>(() => {
    const saved = localStorage.getItem(LAST_QUALITY_KEY);
    if (saved) return saved;
    return localStorage.getItem(LAST_FORMAT_KEY) === 'mp3' ? '320' : '1080';
  });
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const autoDownloadedRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(LAST_FORMAT_KEY, format);
  }, [format]);

  useEffect(() => {
    localStorage.setItem(LAST_QUALITY_KEY, quality);
  }, [quality]);

  useEffect(() => {
    if (!settings) return;
    if (localStorage.getItem(LAST_QUALITY_KEY)) return;
    setQuality(format === 'mp4' ? settings.defaultVideoQuality : settings.defaultAudioQuality);
  }, [settings, format]);

  const activeJob = activeJobId ? jobs.find((j) => j.id === activeJobId) ?? null : null;

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'completed' || !activeJob.downloadUrl) return;
    if (autoDownloadedRef.current === activeJob.id) return;
    autoDownloadedRef.current = activeJob.id;

    const link = document.createElement('a');
    link.href = api.downloadUrl(activeJob.id);
    link.download = activeJob.fileName ?? '';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [activeJob]);

  const startDownload = async (targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed || submitting || activeJob?.status === 'queued' || activeJob?.status === 'processing') {
      return;
    }
    const guard = validateMediaUrl(trimmed);
    if (!guard.ok) {
      setError(guard.message ?? 'Enter a valid URL.');
      return;
    }

    setSubmitting(true);
    setError(null);
    autoDownloadedRef.current = null;

    try {
      const { job } = await api.directDownload({
        url: trimmed,
        outputFormat: format,
        quality,
      });
      upsertJob(job);
      setActiveJobId(job.id);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error('Download failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setUrl(text);
        setError(null);
        void startDownload(text);
      }
    } catch {
      toast.info('Clipboard unavailable', 'Paste the URL with Ctrl+V.');
    }
  };

  const handleDownload = async (event: React.FormEvent) => {
    event.preventDefault();
    await startDownload(url);
  };

  const handleCancel = async () => {
    if (!activeJob) return;
    setCancelling(true);
    try {
      const updated = await api.cancelJob(activeJob.id);
      upsertJob(updated);
    } catch (err) {
      toast.error('Could not cancel', getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const qualities = format === 'mp4' ? MP4_QUALITIES : MP3_QUALITIES;
  const recentDownloads = jobs.slice(0, 3);
  const isRunning =
    submitting || activeJob?.status === 'queued' || activeJob?.status === 'processing';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero Banner */}
      <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-card via-card to-rose-50/70 px-6 py-6 shadow-sm dark:border-white/[0.07] dark:from-[#141720] dark:via-[#151822] dark:to-[#1e1218] sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="YTDownloader"
            className="size-14 shrink-0 rounded-2xl bg-white/95 object-contain p-1 shadow-md"
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              <span className="text-[#ff2a3c]">YT</span>Downloader
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Download YouTube videos and audio, anytime, anywhere!
            </p>
          </div>
        </div>

        {/* Decorative badges */}
        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300">
            <Film className="size-3.5" />
            MP4
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300">
            <AudioLines className="size-3.5" />
            MP3
          </div>
        </div>
      </div>

      {/* Main URL + Quick Options Card */}
      <form
        onSubmit={(e) => void handleDownload(e)}
        className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#13161f]/90 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex flex-1 items-center">
            <Link2 className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').trim();
                if (!pasted) return;
                e.preventDefault();
                setUrl(pasted);
                setError(null);
                void startDownload(pasted);
              }}
              placeholder="Paste YouTube URL here..."
              aria-label="YouTube URL"
              className="h-12 rounded-xl border-border bg-background pl-10 pr-24 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-[#ff2a3c] dark:border-white/10 dark:bg-[#0d0f15]"
              disabled={isRunning}
              spellCheck={false}
              autoComplete="off"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {url && !isRunning && (
                <button
                  type="button"
                  onClick={() => {
                    setUrl('');
                    setError(null);
                  }}
                  aria-label="Clear URL"
                  className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void handlePaste()}
                disabled={isRunning}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary/70 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200"
              >
                <Copy className="size-3" />
                Paste
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            loading={submitting}
            disabled={isRunning || !url.trim()}
            className="h-12 shrink-0 rounded-xl bg-gradient-to-r from-[#ff2a3c] to-[#dc2626] px-6 text-sm font-semibold text-white shadow-[0_6px_22px_rgba(239,35,60,0.35)] hover:from-[#ff3b4c] hover:to-[#ef233c]"
          >
            {!submitting && <Download className="size-4" />}
            {submitting ? 'Starting…' : 'Download'}
          </Button>
        </div>

        {/* Quick Options Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3.5 text-xs dark:border-white/[0.06]">
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <Zap className="size-3.5" />
            Quick Options:
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                setFormat('mp4');
                setQuality(settings?.defaultVideoQuality ?? '1080');
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-all',
                format === 'mp4'
                  ? 'border-[#ff2a3c] bg-[#ff2a3c]/10 text-[#dc2626] dark:bg-[#ff2a3c]/15 dark:text-white'
                  : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]',
              )}
            >
              <Film className="size-3.5" />
              Video (MP4)
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                setFormat('mp3');
                setQuality(settings?.defaultAudioQuality ?? '320');
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-all',
                format === 'mp3'
                  ? 'border-[#ff2a3c] bg-[#ff2a3c]/10 text-[#dc2626] dark:bg-[#ff2a3c]/15 dark:text-white'
                  : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]',
              )}
            >
              <AudioLines className="size-3.5" />
              Audio (MP3)
            </button>
          </div>

          <div className="hidden h-4 w-px bg-border dark:bg-white/10 sm:block" />

          <label className="flex items-center gap-2 text-muted-foreground">
            <span>Quality:</span>
            <select
              value={quality}
              disabled={isRunning}
              onChange={(e) => setQuality(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-[#ff2a3c] dark:border-white/10 dark:bg-[#0d0f15]"
            >
              {qualities.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-muted-foreground">
            <span>Format:</span>
            <select
              value={format}
              disabled={isRunning}
              onChange={(e) => {
                const next = e.target.value as OutputFormat;
                setFormat(next);
                setQuality(
                  next === 'mp4'
                    ? settings?.defaultVideoQuality ?? '1080'
                    : settings?.defaultAudioQuality ?? '320',
                );
              }}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium uppercase text-foreground outline-none focus:border-[#ff2a3c] dark:border-white/10 dark:bg-[#0d0f15]"
            >
              <option value="mp4">MP4</option>
              <option value="mp3">MP3</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <CircleSlash className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Active Download Progress */}
        {activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing') && (
          <div className="mt-4 rounded-xl border border-[#ff2a3c]/30 bg-secondary/40 p-3.5 dark:bg-[#0d0f15]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate text-xs font-medium text-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-[#ff2a3c]" />
                {activeJob.fileName ?? activeJob.media?.title ?? 'Preparing download…'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                loading={cancelling}
                onClick={() => void handleCancel()}
              >
                Cancel
              </Button>
            </div>
            <Progress
              value={activeJob.status === 'queued' ? 0 : activeJob.progress}
              indeterminate={activeJob.status === 'queued'}
              className="mt-2.5 h-1.5"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted-foreground">
              <span>
                {activeJob.status === 'processing'
                  ? `${Math.round(activeJob.progress)}% · ${formatSpeed(activeJob.speed)}`
                  : 'Queued…'}
              </span>
              <span>
                {activeJob.status === 'processing' ? `ETA ${formatEta(activeJob.etaSeconds)}` : ''}
              </span>
            </div>
          </div>
        )}
      </form>

      {/* Bottom 2-column Grid: Recent Downloads + Features */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent Downloads */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#13161f]/90 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock3 className="size-4 text-muted-foreground" />
              Recent Downloads
            </h2>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              View All
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {recentDownloads.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 p-2.5 dark:border-white/[0.06] dark:bg-[#0d0f15]/80"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary dark:bg-white/5">
                    {job.media?.thumbnail ? (
                      <img
                        src={job.media.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-muted-foreground">
                        {job.outputFormat === 'mp3' ? (
                          <AudioLines className="size-4" />
                        ) : (
                          <Film className="size-4" />
                        )}
                      </div>
                    )}
                    {job.media?.duration ? (
                      <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 font-mono text-[9px] text-white">
                        {formatDuration(job.media.duration)}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {job.fileName ?? job.media?.title ?? 'Media'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] uppercase text-muted-foreground">
                      {job.outputFormat}
                      {job.fileSize ? ` · ${formatBytes(job.fileSize)}` : ''}
                      {` · ${job.quality}${job.outputFormat === 'mp3' ? 'kbps' : job.quality === '4k' ? '' : 'p'}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {job.status === 'completed' ? (
                    <>
                      <span className="hidden items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                        <CheckCircle2 className="size-3.5" />
                        Downloaded
                      </span>
                      {job.downloadUrl && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Play media"
                            className="text-foreground hover:bg-[#ff2a3c]/15 hover:text-[#dc2626] dark:hover:text-white"
                            onClick={() =>
                              setPlaying({
                                title: job.fileName ?? job.media?.title ?? 'Media',
                                src: api.streamUrl(job.id),
                                downloadUrl: api.downloadUrl(job.id),
                                format: job.outputFormat,
                                thumbnail: job.media?.thumbnail,
                              })
                            }
                          >
                            <Play className="size-4 fill-current" />
                          </Button>
                          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                            <a href={api.downloadUrl(job.id)} download aria-label="Save file">
                              <FolderOpen className="size-4" />
                            </a>
                          </Button>
                        </>
                      )}
                    </>
                  ) : job.status === 'failed' ? (
                    <span className="text-[11px] font-medium text-destructive">Failed</span>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {Math.round(job.progress)}%
                    </span>
                  )}
                </div>
              </div>
            ))}

            {recentDownloads.length === 0 && (
              <p className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
                No downloads yet. Paste a URL above to get started.
              </p>
            )}
          </div>
        </section>

        {/* Features Card */}
        <section className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#13161f]/90 sm:p-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              Features
            </h2>
            <ul className="mt-4 space-y-2.5">
              {FEATURES.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5 text-xs text-foreground/85">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#ff2a3c] text-white">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-[#ff2a3c]/15 via-[#ef233c]/10 to-transparent px-4 py-3 text-center dark:from-[#ff2a3c]/25 dark:via-[#ef233c]/15">
            <p className="text-xs font-semibold italic text-[#dc2626] dark:text-amber-200">
              Enjoy Downloading!
            </p>
          </div>
        </section>
      </div>

      <PlayerModal media={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
