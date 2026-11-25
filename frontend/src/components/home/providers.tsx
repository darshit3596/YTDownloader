import { motion } from 'framer-motion';
import { ArrowUpRight, CloudUpload, Link2, Youtube } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';

const providers = [
  {
    index: '01',
    icon: Link2,
    title: 'Direct media URLs',
    tag: 'HTTP / HTTPS',
    description:
      'Authorized links to media you host or have permission to fetch. Every request is SSRF-guarded, size-checked and streamed to disk.',
    bullets: ['Redirect validation', 'Type + size limits', 'Streamed, never buffered'],
  },
  {
    index: '02',
    icon: CloudUpload,
    title: 'Your own uploads',
    tag: 'Local files',
    description:
      'Drag in video or audio you own. FFprobe reads real streams, duration and resolution before the conversion pipeline starts.',
    bullets: ['MP4 / MOV / WEBM / MKV / AVI', 'MP3 / WAV / M4A / FLAC', 'Up to 512 MB per file'],
  },
  {
    index: '03',
    icon: Youtube,
    title: 'YouTube metadata',
    tag: 'Official API',
    description:
      'YouTube Data API v3 fetches public title, thumbnail, channel and duration. We link you to Studio for content you own — no stream extraction.',
    bullets: ['Official API only', 'No DRM circumvention', 'Studio deep link'],
  },
];

export function Providers() {
  return (
    <section id="providers" className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="Supported sources"
        title={
          <>
            One workspace, three <span className="text-gradient">authorized paths</span>
          </>
        }
        description="MediaFlow is deliberately scoped. It is not a stream ripper — it is a controlled conversion pipeline for media you are allowed to use."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {providers.map((provider, index) => (
          <motion.article
            key={provider.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow-sm sm:p-6"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-primary/10 blur-3xl transition-opacity group-hover:opacity-100 sm:opacity-60" />
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-xl border border-border/70 bg-secondary/60 text-primary">
                <provider.icon className="size-5" />
              </div>
              <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted-foreground/60">
                {provider.index}
              </span>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <h3 className="text-[15px] font-semibold">{provider.title}</h3>
              <span className="rounded-full border border-border/70 bg-background/50 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {provider.tag}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {provider.description}
            </p>
            <ul className="mt-4 space-y-1.5">
              {provider.bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-2 text-[12px] text-muted-foreground/90">
                  <ArrowUpRight className="size-3 text-primary/70" />
                  {bullet}
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
