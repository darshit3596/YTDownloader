import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AudioLines,
  Download,
  Film,
  History as HistoryIcon,
  Play,
  Search,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlayerModal, type PlayableMedia } from '@/components/media/player-modal';
import { api } from '@/services/api';
import { useHistoryStore } from '@/store/history-store';
import { toast } from '@/store/toast-store';
import { cn, formatBytes, formatRelativeDate } from '@/lib/utils';
import type { HistoryEntry } from '@/types';

export function HistoryPage() {
  const entries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearAll = useHistoryStore((s) => s.clearAll);

  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.fileName.toLowerCase().includes(q) || entry.format.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const totalSize = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.fileSize ?? 0), 0),
    [entries],
  );

  const handleDelete = (entry: HistoryEntry) => {
    removeEntry(entry.id);
    toast.success('History entry removed', entry.fileName);
  };

  const handleClear = () => {
    const count = entries.length;
    clearAll();
    setConfirmClear(false);
    toast.success('History cleared', `${count} entries removed.`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Library"
        title="History"
        description="Your download history saved locally in your browser."
        actions={
          entries.length > 0 ? (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <Button variant="destructive" size="sm" onClick={handleClear}>
                  Confirm clear
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)}>
                <Trash2 className="size-3.5" />
                Clear all
              </Button>
            )
          ) : null
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/50 p-3.5">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Files</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular">{entries.length}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/50 p-3.5">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Total size</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular">{formatBytes(totalSize)}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-border/70 bg-card/50 p-3.5 sm:col-span-1">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Latest</p>
          <p className="mt-1.5 truncate text-sm font-medium">
            {entries[0] ? formatRelativeDate(entries[0].createdAt) : '—'}
          </p>
        </div>
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by file name or format…"
          className="h-9 pl-9 text-[12.5px]"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/80 bg-card/40">
        <div className="hidden grid-cols-[1.8fr_0.6fr_0.7fr_0.8fr_auto] items-center gap-3 border-b border-border/70 bg-secondary/30 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
          <span>File</span>
          <span>Format</span>
          <span>Size</span>
          <span>Converted</span>
          <span className="text-right">Actions</span>
        </div>

        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground">
              <HistoryIcon className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">
              {entries.length === 0 ? 'Nothing downloaded yet' : 'No matching entries'}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              {entries.length === 0
                ? 'Completed downloads will be saved here in your browser.'
                : 'Try a different search term.'}
            </p>
            {entries.length === 0 && (
              <Button size="sm" className="mt-5" asChild>
                <Link to="/">Start a download</Link>
              </Button>
            )}
          </div>
        )}

        {filtered.map((entry) => {
          const Icon = entry.format === 'mp3' ? AudioLines : Film;
          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 transition-colors hover:bg-secondary/20 sm:grid-cols-[1.8fr_0.6fr_0.7fr_0.8fr_auto]',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-secondary/50 text-primary">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium" title={entry.fileName}>
                    {entry.fileName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground sm:hidden">
                    {formatBytes(entry.fileSize)} · {formatRelativeDate(entry.createdAt)}
                  </p>
                </div>
              </div>
              <div className="hidden sm:block">
                <Badge variant={entry.format === 'mp3' ? 'default' : 'accent'} className="uppercase">
                  {entry.format}
                </Badge>
              </div>
              <span className="hidden font-mono text-[11.5px] text-muted-foreground tabular sm:block">
                {formatBytes(entry.fileSize)}
              </span>
              <span className="hidden text-[11.5px] text-muted-foreground sm:block">
                {formatRelativeDate(entry.createdAt)}
              </span>
              <div className="flex items-center justify-end gap-1">
                {entry.jobId && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Play ${entry.fileName}`}
                      onClick={() =>
                        setPlaying({
                          title: entry.fileName,
                          src: api.streamUrl(entry.jobId!),
                          downloadUrl: api.downloadUrl(entry.jobId!),
                          format: entry.format === 'mp3' ? 'mp3' : 'mp4',
                        })
                      }
                    >
                      <Play className="size-3.5 fill-current" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a href={api.downloadUrl(entry.jobId)} download aria-label={`Download ${entry.fileName}`}>
                        <Download className="size-3.5" />
                      </a>
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${entry.fileName}`}
                  onClick={() => handleDelete(entry)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <PlayerModal media={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
