import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useToastStore, toastIcons } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const accent: Record<string, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-accent',
  warning: 'text-warning',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = toastIcons[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-border/80 bg-card/95 p-3.5 shadow-float backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <Icon className={cn('mt-0.5 size-4 shrink-0', accent[t.variant])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight">{t.title}</p>
                  {t.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
