import { motion } from 'framer-motion';
import { AudioLines, ArrowRight, Film, Info } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const audioPresets = [
  { value: '128 kbps', label: 'Compact', hint: 'Voice notes · podcasts' },
  { value: '192 kbps', label: 'Balanced', hint: 'Everyday listening' },
  { value: '256 kbps', label: 'High fidelity', hint: 'Music · archives' },
  { value: '320 kbps', label: 'Maximum', hint: 'Studio masters' },
];

const videoPresets = [
  { value: '360p', label: 'Mobile', hint: 'Smallest output' },
  { value: '480p', label: 'SD', hint: 'Lightweight sharing' },
  { value: '720p', label: 'HD', hint: 'Web-ready' },
  { value: '1080p', label: 'Full HD', hint: 'Presentation quality' },
  { value: '4K', label: 'Ultra HD', hint: 'Source must be ≥ 2160p' },
];

export function Capabilities() {
  const navigate = useNavigate();

  return (
    <section id="capabilities" className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="Conversion engine"
        title={
          <>
            Two output families. <span className="text-gradient">Precise presets.</span>
          </>
        }
        description="FFprobe inspects the real source first. If a resolution or stream isn't available, the option is disabled instead of producing an upscaled or broken file."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-7"
        >
          <div className="pointer-events-none absolute -left-10 -top-16 size-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow-sm">
                <AudioLines className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Audio extraction</h3>
                <p className="text-xs text-muted-foreground">MP3 · LAME encoder · metadata preserved</p>
              </div>
            </div>
            <Badge variant="default">MP3</Badge>
          </div>

          <div className="mt-6 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
            {audioPresets.map((preset) => (
              <div
                key={preset.value}
                className="flex items-center justify-between gap-3 bg-background/30 px-3.5 py-2.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12px] font-medium">{preset.value}</span>
                  <span className="text-[11.5px] text-muted-foreground">{preset.label}</span>
                </div>
                <span className="text-[10.5px] text-muted-foreground/70">{preset.hint}</span>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-5 w-full"
            onClick={() => navigate('/downloader')}
          >
            Convert video to MP3
            <ArrowRight className="size-3.5" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-7"
        >
          <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-accent/15 blur-3xl" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl border border-accent/25 bg-accent/12 text-accent">
                <Film className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Video transcoding</h3>
                <p className="text-xs text-muted-foreground">MP4 · H.264 + AAC · resolution aware</p>
              </div>
            </div>
            <Badge variant="accent">MP4</Badge>
          </div>

          <div className="mt-6 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
            {videoPresets.map((preset) => (
              <div
                key={preset.value}
                className="flex items-center justify-between gap-3 bg-background/30 px-3.5 py-2"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12px] font-medium">{preset.value}</span>
                  <span className="text-[11.5px] text-muted-foreground">{preset.label}</span>
                </div>
                <span className="text-[10.5px] text-muted-foreground/70">{preset.hint}</span>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-5 w-full"
            onClick={() => navigate('/downloader')}
          >
            Transcode to MP4
            <ArrowRight className="size-3.5" />
          </Button>
        </motion.div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11.5px] text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        Output options are generated per source. Disabled resolutions are marked with a reason.
      </p>
    </section>
  );
}
