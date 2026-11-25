import { Logo } from '@/components/brand/logo';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <Logo />
        <p>Authorized media &amp; YouTube downloader · local FFmpeg + yt-dlp</p>
      </div>
    </footer>
  );
}
