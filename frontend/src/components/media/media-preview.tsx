import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { JobStatus } from '@/types';
import type { MediaItem } from '@/types';
import {
  ArrowUpRight,
  AudioLines,
  Clock3,
  FileAudio2,
  FileVideo2,
  Film,
  ImageOff,
  MonitorPlay,
  Youtube,
} from 'lucide-react';
import { cn, formatBytes, formatDuration, truncateMiddle } from '@/lib/utils';
import { useState } from 'react';

const sourceMeta: Record<
  MediaItem['sourceType'],
  { label: string; icon: typeof Film; variant: 'default' | 'secondary' | 'accent' }
> = {
  direct_url: { label: 'Direct URL', icon: ArrowUpRight, variant: 'default' },
  upload: { label: 'Local upload', icon: MonitorPlay, variant: 'secondary' },
  youtube: { label: 'YouTube', icon: Youtube, variant: 'accent' },
};

export function MediaPreview({
  media,
  onReplace,
}: {
  media: MediaItem;
  onReplace?: () => void;
}) {
  const [thumbError, setThumbError] = useState(false);
  const meta = sourceMeta[media.sourceType];

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/50">
      <div className="relative aspect-video w-full overflow-hidden bg-[linear-gradient(135deg,rgba(124,92,255,0.18),rgba(59,157,255,0.08))]">
        {media.thumbnail && !thumbError ? (
          <img
            src={media.thumbnail}
            alt={media.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setThumbError(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
              {media.hasVideo ? <Film className="size-9" /> : <AudioLines className="size-9" />}
              <span className="flex items-center gap-1.5 text-[11px]">
                <ImageOff className="size-3" />
                No artwork
              </span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent p-3">
          <Badge variant={meta.variant} className="backdrop-blur-md">
            <meta.icon className="size-3" />
            {meta.label}
          </Badge>
          {media.duration ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-white backdrop-blur-md">
              <Clock3 className="size-2.5" />
              {formatDuration(media.duration)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3.5 p-4 sm:p-5">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug" title={media.title}>
            {media.title}
          </h3>
          {media.channel && (
            <p className="mt-1 text-[11.5px] text-muted-foreground">by {media.channel}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">
            {media.hasVideo ? <FileVideo2 className="size-3" /> : <FileAudio2 className="size-3" />}
            {media.mimeType?.split('/')[1]?.toUpperCase() ?? (media.hasVideo ? 'VIDEO' : 'AUDIO')}
          </Badge>
          {media.width && media.height ? (
            <Badge variant="outline">
              {media.width}×{media.height}
            </Badge>
          ) : null}
          {media.fileSize ? <Badge variant="outline">{formatBytes(media.fileSize)}</Badge> : null}
          {media.hasVideo && media.hasAudio ? (
            <Badge variant="outline">A/V</Badge>
          ) : media.hasVideo ? (
            <Badge variant="outline">Video only</Badge>
          ) : (
            <Badge variant="outline">Audio only</Badge>
          )}
        </div>

        {media.sourceUrl && (
          <p
            className="truncate rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-[10.5px] text-muted-foreground"
            title={media.sourceUrl}
          >
            {truncateMiddle(media.sourceUrl, 72)}
          </p>
        )}

        {media.sourceType === 'youtube' && (
          <div className="rounded-xl border border-accent/20 bg-accent/[0.06] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
              <Youtube className="size-3.5" />
              Ready to download as MP3 or MP4 using yt-dlp.
            </p>
          </div>
        )}

        {onReplace && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onReplace}>
            Change source
          </Button>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<
    JobStatus,
    { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'outline'; dot?: string }
  > = {
    queued: { label: 'Queued', variant: 'secondary', dot: 'bg-muted-foreground' },
    processing: { label: 'Processing', variant: 'default', dot: 'bg-primary animate-pulse' },
    completed: { label: 'Completed', variant: 'success', dot: 'bg-success' },
    failed: { label: 'Failed', variant: 'destructive', dot: 'bg-destructive' },
    cancelled: { label: 'Cancelled', variant: 'outline', dot: 'bg-muted-foreground' },
  };
  const config = map[status];
  return (
    <Badge variant={config.variant} className={cn('capitalize')}>
      <span className={cn('size-1.5 rounded-full', config.dot)} />
      {config.label}
    </Badge>
  );
}

export function qualityLabel(quality: string, format: string): string {
  if (format === 'mp3') return `${quality} kbps`;
  if (quality === '4k') return '4K';
  return `${quality}p`;
}
