import { ArrowRight, ListChecks, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,rgba(124,92,255,0.16),rgba(59,157,255,0.08)_55%,transparent_85%)] px-6 py-12 text-center sm:px-10 sm:py-14">
        <div className="noise pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[90px]"
          style={{ background: 'radial-gradient(circle, #7c5cff, transparent 68%)' }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
            Ready to convert on <span className="text-gradient">your terms?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-balance text-sm leading-relaxed text-muted-foreground">
            Open the workspace, drop in a source you own, and let the queue handle the rest. Progress
            is real, files are local, and nothing is stored in the database.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate('/downloader')}>
              <Sparkles className="size-4" />
              Open the downloader
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full bg-background/30 sm:w-auto"
              onClick={() => navigate('/jobs')}
            >
              <ListChecks className="size-4" />
              View download manager
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
