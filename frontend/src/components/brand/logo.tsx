import { motion } from 'framer-motion';
import { AudioLines } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative grid size-9 place-items-center rounded-xl bg-brand-gradient shadow-glow-sm',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" aria-hidden="true">
        <path
          d="M3 13c2.2-4.2 4.4 4.2 6.6 0s4.4 4.2 6.6 0S20.6 17 21 13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M3 8.5c2.2-3.4 4.4 3.4 6.6 0s4.4 3.4 6.6 0"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/25" />
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="MediaFlow home">
      <LogoMark className="transition-transform duration-300 group-hover:scale-[1.04]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight">
            Media<span className="text-gradient">Flow</span>
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            media studio
          </span>
        </span>
      )}
    </Link>
  );
}

export function BrandPill() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
    >
      <AudioLines className="size-3.5 text-primary" />
      <span>Authorized media workspace</span>
      <span className="size-1 rounded-full bg-success" />
      <span className="text-foreground/70">FFmpeg powered</span>
    </motion.div>
  );
}
