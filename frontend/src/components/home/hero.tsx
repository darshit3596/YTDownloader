import { motion } from 'framer-motion';
import { ArrowRight, AudioLines, Film, Gauge, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { BrandPill } from '@/components/brand/logo';
import { AnalyzeForm } from '@/components/media/analyze-form';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const stats = [
  { icon: AudioLines, label: 'MP3 128–320 kbps', hint: 'LAME presets' },
  { icon: Film, label: 'MP4 up to 4K', hint: 'H.264 + AAC' },
  { icon: Gauge, label: 'Live progress', hint: 'Socket.IO events' },
  { icon: ShieldCheck, label: 'SSRF protected', hint: 'Validated fetches' },
];

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative isolate overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-18rem] -z-10 size-[42rem] -translate-x-1/2 rounded-full opacity-40 blur-[120px] animate-pulse-glow"
        style={{ background: 'radial-gradient(circle, #7c5cff 0%, #3b9dff 45%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[8%] top-24 -z-10 size-64 rounded-full opacity-20 blur-[100px] animate-float"
        style={{ background: 'radial-gradient(circle, #22d3ee, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <BrandPill />

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[1.03] tracking-[-0.035em] sm:text-6xl lg:text-[4.4rem]"
          >
            Your Media. Your Format.
            <span className="mt-1 block text-gradient">Your Control.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            className="mt-5 max-w-2xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-base"
          >
            Manage authorized media downloads and convert your media files into your preferred
            format. A premium workspace for direct URLs, your own uploads and official YouTube
            metadata.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
            className="mt-8 w-full"
          >
            <div className="panel glow-ring relative mx-auto max-w-3xl p-3 shadow-float sm:p-4">
              <AnalyzeForm />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Also available
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full bg-background/40"
                onClick={() => navigate('/downloader')}
              >
                <Sparkles className="size-3.5 text-primary" />
                Upload your own file
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full"
                onClick={() => navigate('/jobs')}
              >
                <Zap className="size-3.5" />
                Open download manager
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:border-primary/25"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <stat.icon className="size-4" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-[11.5px] font-semibold leading-tight">{stat.label}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{stat.hint}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
