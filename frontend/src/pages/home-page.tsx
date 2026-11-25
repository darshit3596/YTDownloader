import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hero } from '@/components/home/hero';
import { Providers } from '@/components/home/providers';
import { Features } from '@/components/home/features';
import { Capabilities } from '@/components/home/capabilities';
import { Compliance } from '@/components/home/compliance';
import { CtaSection } from '@/components/home/cta';

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('section');

  useEffect(() => {
    if (!section) return;
    const timer = window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSearchParams({}, { replace: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [section, setSearchParams]);

  return (
    <div>
      <Hero />
      <Providers />
      <Features />
      <Capabilities />
      <Compliance />
      <CtaSection />
    </div>
  );
}
