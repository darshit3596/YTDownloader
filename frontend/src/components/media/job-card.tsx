import { useState } from 'react';
import {
  AlertCircle,
  AudioLines,
  Download,
  Film,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Job } from '@/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlayerModal, type PlayableMedia } from '@/components/media/player-modal';
import { api, getErrorMessage } from '@/services/api';
import { useJobStore } from '@/store/job-store';
import { toast } from '@/store/toast-store';
import { StatusBadge, qualityLabel } from '@/components/media/media-preview';
import { cn, formatBytes, formatEta, formatRelativeDate, formatSpeed } from '@/lib/utils';

export function JobCard({
  job,
  onRemove,
  compact = false,
}: {
  job: Job;
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  const upsertJob = useJobStore((s) => s.upsertJob);
  const [action, setAction] = useState<'cancel' | 'retry' | null>(null);
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const isActive = job.status === 'queued' || job.status === 'processing';
  const progress = Math.round(job.progress ?? 0);

  const handleCancel = async () => {
    setAction('cancel');
    try {
      const updated = await api.cancelJob(job.id);
      upsertJob(updated);
      toast.info('Job cancelled', 'Temporary files were cleaned up.');
    } catch (error) {
      toast.error('Could not cancel job', getErrorMessage(error));
    } finally {
      setAction(null);
    }
  };

  const handleRetry = async () => {
    setAction('retry');
    try {
      const updated = await api.retryJob(job.id);
      upsertJob(updated);
      toast.success('Job re-queued', 'The conversion will start again shortly.');
    } catch (error) {
      toast.error('Could not retry job', getErrorMessage(error));
    } finally {
      setAction(null);
    }
  };

  const FormatIcon = job.outputFormat === 'mp3' ? AudioLines : Film;

  return (
    <article className="group rounded-2xl border border-border/80 bg-card/60 p-3.5 transition-colors hover:border-border sm:p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={cn(
            'relative hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-secondary/50 sm:block',
            job.status === 'processing' && 'ring-1 ring-primary/40',
          )}
        >
          {job.media?.thumbnail ? (
            <img
              src={job.media.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground/60">
              <FormatIcon className="size-5" />
            </div>
          )}
          {job.status === 'processing' && (
            <div className="absolute inset-x-0 bottom-0">
              <Progress value={progress} className="h-0.5 rounded-none bg-black/30" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 max-w-full truncate text-[13px] font-semibold sm:max-w-[50%]">
              {job.fileName ?? job.media?.title ?? 'Untitled conversion'}
            </h3>
            <StatusBadge status={job.status} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 font-mono text-[10px] uppercase">
              {job.outputFormat}
            </span>
            <span>{qualityLabel(job.quality, job.outputFormat)}</span>
            {job.fileSize ? (
              <>
                <span className="text-border">·</span>
                <span className="tabular">{formatBytes(job.fileSize)}</span>
              </>
            ) : null}
            <span className="text-border">·</span>
            <span>{formatRelativeDate(job.createdAt)}</span>
          </div>

          {isActive && (
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10.5px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {job.status === 'queued' ? (
                    'Waiting for an available worker'
                  ) : (
                    <>
                      <Loader2 className="size-3 animate-spin text-primary" />
                      Converting
                    </>
                  )}
                </span>
                <span className="font-mono tabular text-[10.5px] text-muted-foreground">
                  {job.status === 'processing' ? `${progress}%` : '—'}
                </span>
              </div>
              <Progress
                value={job.status === 'queued' ? 0 : progress}
                indeterminate={job.status === 'queued'}
                className="h-1.5"
              />
              {job.status === 'processing' && (
                <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground/80 tabular">
                  <span>{formatSpeed(job.speed)}</span>
                  <span>ETA {formatEta(job.etaSeconds)}</span>
                </div>
              )}
            </div>
          )}

          {job.status === 'failed' && job.errorMessage && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/[0.07] px-2.5 py-1.5 text-[11px] text-destructive">
              <AlertCircle className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-2">{job.errorMessage}</span>
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <JobActions
              job={job}
              action={action}
              onCancel={handleCancel}
              onRetry={handleRetry}
              onPlay={setPlaying}
              onRemove={onRemove}
              compact={compact}
            />
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <JobActions
            job={job}
            action={action}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onPlay={setPlaying}
            onRemove={onRemove}
            compact={compact}
          />
        </div>
      </div>
      <PlayerModal media={playing} onClose={() => setPlaying(null)} />
    </article>
  );
}

function JobActions({
  job,
  action,
  onCancel,
  onRetry,
  onPlay,
  onRemove,
  compact = false,
}: {
  job: Job;
  action: 'cancel' | 'retry' | null;
  onCancel: () => void;
  onRetry: () => void;
  onPlay: (media: PlayableMedia) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  const isActive = job.status === 'queued' || job.status === 'processing';

  if (isActive) {
    return (
      <Button
        variant="destructive"
        size={compact ? 'icon-sm' : 'sm'}
        className={compact ? 'size-8' : 'h-8'}
        onClick={onCancel}
        loading={action === 'cancel'}
        disabled={action !== null}
        aria-label={compact ? 'Cancel job' : undefined}
      >
        {action !== 'cancel' && <X className="size-3.5" />}
        {!compact && 'Cancel'}
      </Button>
    );
  }

  if (job.status === 'completed') {
    const available = job.fileAvailable !== false;
    return (
      <>
        {available ? (
          <>
            <Button
              type="button"
              variant="outline"
              size={compact ? 'icon-sm' : 'sm'}
              className={compact ? 'size-8' : 'h-8'}
              aria-label={`Play ${job.fileName ?? 'converted file'}`}
              onClick={() =>
                onPlay({
                  title: job.fileName ?? job.media?.title ?? 'Media',
                  src: api.streamUrl(job.id),
                  downloadUrl: api.downloadUrl(job.id),
                  format: job.outputFormat,
                  thumbnail: job.media?.thumbnail,
                })
              }
            >
              <Play className="size-3.5 fill-current" />
              {!compact && 'Play'}
            </Button>
            <Button asChild size={compact ? 'icon-sm' : 'sm'} className={compact ? 'size-8' : 'h-8'}>
              <a
                href={api.downloadUrl(job.id)}
                download
                aria-label={`Download ${job.fileName ?? 'converted file'}`}
              >
                <Download className="size-3.5" />
                {!compact && 'Download'}
              </a>
            </Button>
          </>
        ) : (
          <span className="rounded-lg border border-border/70 px-2 py-1 text-[10.5px] text-muted-foreground">
            File removed
          </span>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8"
            aria-label="Remove from list"
            onClick={() => onRemove(job.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'sm'}
        className={compact ? 'size-8' : 'h-8'}
        onClick={onRetry}
        loading={action === 'retry'}
        disabled={action !== null}
        aria-label={compact ? 'Retry job' : undefined}
      >
        {action !== 'retry' && <RotateCcw className="size-3.5" />}
        {!compact && 'Retry'}
      </Button>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8"
          aria-label="Remove from list"
          onClick={() => onRemove(job.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </>
  );
}
