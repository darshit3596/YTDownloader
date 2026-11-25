import { motion } from 'framer-motion';
import { ArrowRight, FileCheck2, Lock, ShieldCheck, Video, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const willNot = [
  'Extract or rip protected YouTube streams',
  'Bypass DRM, paywalls or access controls',
  'Use undocumented or internal endpoints',
  'Fetch private, loopback or link-local hosts',
  'Store media binaries inside the database',
];

const safeguards = [
  { icon: Lock, text: 'Every fetch resolves DNS first and rejects private ranges, redirect chains included.' },
  { icon: FileCheck2, text: 'Uploads are extension- and MIME-checked, size-capped and stored with sanitized names.' },
  { icon: Video, text: 'FFmpeg runs through argument arrays — never a shell string — so filenames cannot inject commands.' },
];

export function Compliance() {
  const navigate = useNavigate();

  return (
    <section id="compliance" className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/50"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
              <ShieldCheck className="size-3.5" />
              Responsible by design
            </span>
            <h2 className="mt-4 text-balance text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
              Built for content you own.
              <span className="block text-muted-foreground/80">Not for content you don’t.</span>
            </h2>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              MediaFlow is a conversion workspace, not a streaming downloader. YouTube support is
              limited to public metadata through the official Data API, plus a link to your own
              Studio dashboard.
            </p>

            <div className="mt-6 space-y-3">
              {safeguards.map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-border/70 bg-secondary/50 text-primary">
                    <item.icon className="size-3.5" />
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>

            <Button className="mt-7" size="sm" onClick={() => navigate('/downloader')}>
              Start with an authorized file
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/40 p-5">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <X className="size-4 text-destructive" />
              What MediaFlow will never do
            </h3>
            <ul className="mt-4 space-y-3">
              {willNot.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[12.5px] leading-snug">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive/70" />
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl border border-warning/20 bg-warning/[0.07] p-3 text-[11.5px] leading-relaxed text-warning/90">
              By using MediaFlow you confirm you have the rights to download and convert the media
              you submit. Unauthorized use is your responsibility.
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
