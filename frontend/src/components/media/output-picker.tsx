import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AudioLines,
  BadgeCheck,
  CircleSlash,
  Clock3,
  Film,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { MediaItem, OutputFormat, OutputOption } from '@/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api, getErrorMessage } from '@/services/api';
import { useJobStore } from '@/store/job-store';
import { useSettingsStore } from '@/store/settings-store';
import { toast } from '@/store/toast-store';
import { cn, formatBytes } from '@/lib/utils';

const AUDIO_OPTIONS: OutputOption[] = [
  { format: 'mp3', quality: '128', label: '128 kbps', description: 'Compact', available: true },
  { format: 'mp3', quality: '192', label: '192 kbps', description: 'Balanced', available: true },
  { format: 'mp3', quality: '256', label: '256 kbps', description: 'High fidelity', available: true },
  { format: 'mp3', quality: '320', label: '320 kbps', description: 'Maximum', available: true },
];

const VIDEO_OPTIONS: OutputOption[] = [
  { format: 'mp4', quality: '360', label: '360p', description: 'Mobile', available: true },
  { format: 'mp4', quality: '480', label: '480p', description: 'SD', available: true },
  { format: 'mp4', quality: '720', label: '720p', description: 'HD', available: true },
  { format: 'mp4', quality: '1080', label: '1080p', description: 'Full HD', available: true },
  { format: 'mp4', quality: '4k', label: '4K', description: 'Ultra HD', available: true },
];

function sanitizeName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

function defaultFileName(media: MediaItem): string {
  const base = sanitizeName(media.title || media.fileName || 'mediaflow-output');
  return base || 'mediaflow-output';
}

export function OutputPicker({ media }: { media: MediaItem }) {
  const navigate = useNavigate();
  const upsertJob = useJobStore((s) => s.upsertJob);
  const presetSettings = useSettingsStore((s) => s.settings);

  const defaultFormat: OutputFormat = media.hasVideo ? 'mp4' : 'mp3';
  const [format, setFormat] = useState<OutputFormat>(defaultFormat);
  const [quality, setQuality] = useState<string>(
    media.hasVideo ? presetSettings?.defaultVideoQuality ?? '720' : presetSettings?.defaultAudioQuality ?? '320',
  );
  const [fileName, setFileName] = useState(defaultFileName(media));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsFor = useMemo(() => {
    const serverOptions = media.outputOptions ?? [];
    const relevant = serverOptions.filter((option) => option.format === format);
    const fallback = format === 'mp3' ? AUDIO_OPTIONS : VIDEO_OPTIONS;
    return fallback.map((base) => {
      const match = relevant.find((option) => option.quality === base.quality);
      return match ?? base;
    });
  }, [format, media.outputOptions]);

  const mp4Available = (media.outputOptions ?? []).some(
    (option) => option.format === 'mp4' && option.available,
  );
  const mp3Available = (media.outputOptions ?? []).some(
    (option) => option.format === 'mp3' && option.available,
  );

  useEffect(() => {
    setFileName(defaultFileName(media));
    const nextFormat: OutputFormat =
      media.hasVideo && ((media.outputOptions ?? []).some((o) => o.format === 'mp4' && o.available) || media.outputOptions.length === 0)
        ? 'mp4'
        : 'mp3';
    setFormat(nextFormat);
    setQuality(
      nextFormat === 'mp4'
        ? presetSettings?.defaultVideoQuality ?? '720'
        : presetSettings?.defaultAudioQuality ?? '320',
    );
    setError(null);
  }, [media, presetSettings]);

  const selectedOption = optionsFor.find((option) => option.quality === quality);
  const firstAvailable = optionsFor.find((option) => option.available);

  useEffect(() => {
    if (!selectedOption?.available && firstAvailable) {
      setQuality(firstAvailable.quality);
    }
  }, [selectedOption, firstAvailable]);

  const extension = format === 'mp3' ? 'mp3' : 'mp4';

  const handleConvert = async () => {
    if (!selectedOption?.available) {
      setError('This quality is not available for the current source.');
      return;
    }
    const cleaned = sanitizeName(fileName);
    if (cleaned.length < 1) {
      setError('Enter a valid output file name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.createConversion({
        mediaId: media.id,
        outputFormat: format,
        quality,
        fileName: cleaned,
      });
      upsertJob(job);
      toast.success('Job queued', `${cleaned}.${extension} will be processed shortly.`);
      navigate('/jobs');
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error('Could not start conversion', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Output settings</h3>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Choose a format, quality preset and output name.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          <Clock3 className="size-3" />
          Queue
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setFormat('mp3');
            setQuality(presetSettings?.defaultAudioQuality ?? '320');
            setError(null);
          }}
          disabled={!mp3Available && media.outputOptions.length > 0}
          className={cn(
            'group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40',
            format === 'mp3'
              ? 'border-primary/60 bg-primary/[0.08] ring-1 ring-primary/30'
              : 'border-border/70 bg-background/40 hover:border-border',
          )}
        >
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg',
              format === 'mp3' ? 'bg-brand-gradient text-white' : 'bg-secondary/70 text-muted-foreground',
            )}
          >
            <AudioLines className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-tight">MP3 Audio</span>
            <span className="mt-0.5 block text-[10.5px] text-muted-foreground">128–320 kbps</span>
          </span>
          {format === 'mp3' && (
            <BadgeCheck className="absolute right-2 top-2 size-3.5 text-primary" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setFormat('mp4');
            setQuality(presetSettings?.defaultVideoQuality ?? '720');
            setError(null);
          }}
          disabled={!mp4Available && media.outputOptions.length > 0}
          className={cn(
            'group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40',
            format === 'mp4'
              ? 'border-accent/60 bg-accent/[0.08] ring-1 ring-accent/30'
              : 'border-border/70 bg-background/40 hover:border-border',
          )}
        >
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg',
              format === 'mp4' ? 'bg-accent text-accent-foreground' : 'bg-secondary/70 text-muted-foreground',
            )}
          >
            <Film className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-tight">MP4 Video</span>
            <span className="mt-0.5 block text-[10.5px] text-muted-foreground">360p–4K · H.264</span>
          </span>
          {format === 'mp4' && (
            <BadgeCheck className="absolute right-2 top-2 size-3.5 text-accent" />
          )}
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Quality preset</Label>
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {format === 'mp3' ? 'Bitrate' : 'Resolution'}
          </span>
        </div>
        <div
          className={cn('grid gap-1.5', format === 'mp3' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}
          role="radiogroup"
          aria-label="Quality preset"
        >
          {optionsFor.map((option) => {
            const active = quality === option.quality;
            return (
              <button
                key={`${option.format}-${option.quality}`}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!option.available}
                title={option.reason}
                onClick={() => {
                  setQuality(option.quality);
                  setError(null);
                }}
                className={cn(
                  'relative rounded-lg border px-2.5 py-2 text-left transition-all',
                  active
                    ? 'border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
                    : 'border-border/70 bg-background/30 hover:border-border',
                  !option.available && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className={cn('font-mono text-[11.5px] font-medium', active && 'text-primary')}>
                    {option.label}
                  </span>
                  {!option.available && <CircleSlash className="size-3 text-muted-foreground" />}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {option.available ? option.description : option.reason ?? 'Unavailable'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <Label htmlFor="output-name" className="text-xs">
          Output file name
        </Label>
        <div className="relative mt-2">
          <Input
            id="output-name"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            maxLength={90}
            spellCheck={false}
            className="pr-16 font-mono text-[12.5px]"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            .{extension}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-3">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground">Estimated output</span>
          <span className="font-mono font-medium tabular">
            {selectedOption?.estimatedSize ? `≈ ${formatBytes(selectedOption.estimatedSize)}` : '—'}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground">Pipeline</span>
          <span className="font-medium">
            {format === 'mp3' ? 'libmp3lame · metadata copy' : 'libx264 · aac · faststart'}
          </span>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[11.5px] text-destructive"
        >
          <CircleSlash className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <Button
        className="mt-4 w-full"
        size="lg"
        onClick={() => void handleConvert()}
        loading={submitting}
        disabled={submitting || !selectedOption?.available}
      >
        {!submitting && <Sparkles className="size-4" />}
        {submitting ? 'Queueing conversion…' : 'Start conversion'}
      </Button>

      <div className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" />
        Jobs run server-side and survive page reloads. Only authorized media may be processed.
      </div>

      {submitting && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Creating job…
        </div>
      )}
    </div>
  );
}
