import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </motion.div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium',
        connected
          ? 'border-success/25 bg-success/10 text-success'
          : 'border-border/70 bg-secondary/50 text-muted-foreground',
      )}
      title={connected ? 'Real-time job events connected' : 'Real-time connection unavailable'}
    >
      <span className={cn('relative flex size-1.5')}>
        {connected && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
        )}
        <span
          className={cn(
            'relative inline-flex size-1.5 rounded-full',
            connected ? 'bg-success' : 'bg-muted-foreground',
          )}
        />
      </span>
      {connected ? 'Live pipeline' : 'Connecting…'}
    </span>
  );
}
