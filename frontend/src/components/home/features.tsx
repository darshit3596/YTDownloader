import { motion } from 'framer-motion';
import {
  AudioLines,
  Database,
  FileVideo2,
  Layers,
  ListChecks,
  Radio,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';

const features = [
  {
    icon: AudioLines,
    title: 'Studio-grade MP3 encoding',
    description:
      'LAME presets at 128, 192, 256 and 320 kbps with metadata carried across from the source file.',
  },
  {
    icon: FileVideo2,
    title: 'MP4 transcoding up to 4K',
    description:
      'H.264 video with AAC audio, resolution-aware presets that never upscale beyond the source.',
  },
  {
    icon: Radio,
    title: 'Real-time Socket.IO progress',
    description:
      'Every FFmpeg progress tick is parsed and streamed to your browser — no simulated estimates.',
  },
  {
    icon: ListChecks,
    title: 'Queue with hard limits',
    description:
      'A configurable worker pool runs a bounded number of FFmpeg processes so your machine stays responsive.',
  },
  {
    icon: Database,
    title: 'SQLite job ledger',
    description:
      'Jobs, media metadata and completed downloads are persisted with Prisma — files stay on disk, never in the database.',
  },
  {
    icon: ShieldCheck,
    title: 'Security-first pipeline',
    description:
      'DNS-aware SSRF blocking, sanitized filenames, strict MIME checks, rate limits and argument-array process spawning.',
  },
];

const steps = [
  {
    number: '01',
    icon: Workflow,
    title: 'Bring an authorized source',
    description: 'Paste a permitted direct URL, upload a file you own, or look up YouTube metadata via the official API.',
  },
  {
    number: '02',
    icon: Layers,
    title: 'Pick format and quality',
    description: 'Only pipeline-supported options are enabled. Name the output, choose MP3 bitrate or MP4 resolution.',
  },
  {
    number: '03',
    icon: FileVideo2,
    title: 'Convert, track and download',
    description: 'Watch live progress, cancel or retry any job, then download the finished file from the manager.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="Capabilities"
        title={
          <>
            Everything a serious media workflow <span className="text-gradient">needs</span>
          </>
        }
        description="Modular providers, a real conversion engine and an operational download manager — built as one coherent product."
      />

      <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
            className="group relative rounded-2xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-primary/25 hover:bg-card/70"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-brand-gradient-soft text-primary ring-1 ring-inset ring-primary/10">
              <feature.icon className="size-[18px]" />
            </div>
            <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 grid gap-4 rounded-3xl border border-border/70 bg-card/40 p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeading
          align="left"
          eyebrow="How it works"
          title="Three steps from source to finished file"
          description="No queues to babysit. MediaFlow keeps the source metadata, the job lifecycle and the output file in sync."
        />
        <div className="relative space-y-3">
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" aria-hidden="true" />
          {steps.map((step) => (
            <div key={step.number} className="relative flex gap-4 rounded-xl p-2">
              <div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-xl border border-border/80 bg-background text-primary">
                <step.icon className="size-4" />
              </div>
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-medium text-primary">{step.number}</span>
                  <h4 className="text-[13px] font-semibold">{step.title}</h4>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
