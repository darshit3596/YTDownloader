import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Inbox,
  ListChecks,
  Plus,
  RefreshCw,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { PageHeader, ConnectionPill } from '@/components/common/page-header';
import { JobCard } from '@/components/media/job-card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useJobStore } from '@/store/job-store';
import { cn } from '@/lib/utils';
import type { Job } from '@/types';

type Filter = 'all' | 'active' | 'completed' | 'failed';

export function JobsPage() {
  const jobs = useJobStore((s) => s.jobs);
  const loading = useJobStore((s) => s.loading);
  const connected = useJobStore((s) => s.connected);
  const queue = useJobStore((s) => s.queue);
  const fetchJobs = useJobStore((s) => s.fetchJobs);
  const removeJob = useJobStore((s) => s.removeJob);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => {
    const active = jobs.filter((j) => j.status === 'processing').length;
    const queued = jobs.filter((j) => j.status === 'queued').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    return { active, queued, completed, failed };
  }, [jobs]);

  const filtered = useMemo(() => {
    if (filter === 'active') return jobs.filter((j) => j.status === 'queued' || j.status === 'processing');
    if (filter === 'completed') return jobs.filter((j) => j.status === 'completed');
    if (filter === 'failed') return jobs.filter((j) => j.status === 'failed');
    return jobs;
  }, [filter, jobs]);

  const maxConcurrent = queue?.maxConcurrent ?? 2;
  const activeCount = queue?.active ?? counts.active;
  const queuedCount = queue?.queued ?? counts.queued;

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  const stats = [
    { label: 'Processing', value: counts.active, icon: Activity, tone: 'text-primary' },
    { label: 'Queued', value: counts.queued, icon: Clock3, tone: 'text-warning' },
    { label: 'Completed', value: counts.completed, icon: CheckCircle2, tone: 'text-success' },
    { label: 'Failed', value: counts.failed, icon: XCircle, tone: 'text-destructive' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Operations"
        title="Download manager"
        description="Live queue, real FFmpeg progress and persisted job history. Jobs keep running if you close this tab."
        actions={
          <>
            <ConnectionPill connected={connected} />
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} loading={refreshing}>
              {!refreshing && <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
            <Button size="sm" asChild>
              <Link to="/downloader">
                <Plus className="size-3.5" />
                New job
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-xl border border-border/70 bg-card/50 p-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className={cn('size-3.5', stat.tone)} />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold tabular">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-border/70 bg-card/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ListChecks className="size-3.5 text-primary" />
            Worker pool
          </span>
          <span className="font-mono text-[11px] text-muted-foreground tabular">
            {activeCount}/{maxConcurrent} active · {queuedCount} waiting
          </span>
        </div>
        <Progress
          value={maxConcurrent ? (activeCount / maxConcurrent) * 100 : 0}
          className="mt-2 h-1"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-secondary/40 p-1">
          {(
            [
              { key: 'all', label: 'All', count: jobs.length },
              { key: 'active', label: 'Active', count: counts.active + counts.queued },
              { key: 'completed', label: 'Completed', count: counts.completed },
              { key: 'failed', label: 'Failed', count: counts.failed },
            ] as { key: Filter; label: string; count: number }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
                filter === tab.key
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/70'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span className="rounded bg-background/60 px-1 font-mono text-[9.5px] text-muted-foreground">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        {!connected && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-warning">
            <WifiOff className="size-3" />
            Live updates offline — refresh to sync
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2.5">
        {loading && jobs.length === 0 && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[86px] animate-pulse rounded-2xl border border-border/60 bg-card/40" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground">
              <Inbox className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">
              {jobs.length === 0 ? 'No jobs yet' : `No ${filter} jobs`}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              {jobs.length === 0
                ? 'Start a conversion and it will appear here with live progress straight from FFmpeg.'
                : 'Switch filters or start a new conversion to fill this view.'}
            </p>
            <Button size="sm" className="mt-5" asChild>
              <Link to="/downloader">
                <Plus className="size-3.5" />
                Open downloader
              </Link>
            </Button>
          </div>
        )}

        {filtered.map((job: Job) => (
          <motion.div key={job.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <JobCard job={job} onRemove={removeJob} />
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-[10.5px] text-muted-foreground">
        Removing a job from this list only hides it locally. Files remain in storage until cleanup.
      </p>
    </div>
  );
}
