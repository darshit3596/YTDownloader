import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Crown,
  Download,
  Globe,
  History,
  Home,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { useJobStore } from '@/store/job-store';
import { useSettingsStore } from '@/store/settings-store';
import { useThemeStore } from '@/store/theme-store';
import { api } from '@/services/api';
import { cn, formatSpeed } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Downloads', to: '/jobs', icon: Download },
  { label: 'History', to: '/history', icon: History },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const connectSocket = useJobStore((s) => s.connectSocket);
  const fetchJobs = useJobStore((s) => s.fetchJobs);
  const setQueue = useJobStore((s) => s.setQueue);
  const jobs = useJobStore((s) => s.jobs);
  const connected = useJobStore((s) => s.connected);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    connectSocket();
    void fetchJobs();
    void fetchSettings();
    void api
      .getQueue()
      .then((stats) => setQueue(stats))
      .catch(() => undefined);
  }, [connectSocket, fetchJobs, setQueue, fetchSettings]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const activeJob = jobs.find((j) => j.status === 'processing');
  const activeSpeed = activeJob?.speed ? formatSpeed(activeJob.speed) : '0 KB/s';

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground dark:bg-[#0b0d12] lg:flex-row">
      {/* Ambient crimson glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-50 dark:opacity-100"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(55rem 30rem at 78% 8%, rgba(239, 35, 60, 0.12), transparent 62%), radial-gradient(40rem 26rem at 12% 95%, rgba(239, 35, 60, 0.09), transparent 60%)',
        }}
      />

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#101218]/90 lg:hidden">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="YTDownloader"
            className="size-8 shrink-0 rounded-lg bg-white/90 object-contain p-0.5 shadow-sm"
          />
          <span className="text-sm font-bold tracking-tight">
            <span className="text-[#ff2a3c]">YT</span>Downloader
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="grid size-8 place-items-center rounded-lg border border-border bg-secondary/60 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/5"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="grid size-8 place-items-center rounded-lg border border-border bg-secondary/60 text-foreground dark:border-white/10 dark:bg-white/5"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className="border-b border-border bg-card p-3 dark:border-white/[0.06] dark:bg-[#101218] lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-[#ef233c]/15 text-[#dc2626] ring-1 ring-inset ring-[#ef233c]/35 dark:bg-gradient-to-r dark:from-[#ef233c]/25 dark:to-transparent dark:text-white'
                      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground dark:hover:bg-white/[0.04]',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border bg-card/90 p-4 dark:border-white/[0.06] dark:bg-[#101218]/95 lg:flex">
        <div>
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="YTDownloader"
                className="size-8 shrink-0 rounded-lg bg-white/90 object-contain p-0.5 shadow-sm"
              />
              <span className="text-[13.5px] font-bold tracking-tight text-foreground">
                <span className="text-[#ff2a3c]">YT</span>Downloader
              </span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="grid size-7 place-items-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10 dark:bg-white/5"
            >
              {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          </div>

          <nav className="mt-6 flex flex-col gap-1.5" aria-label="Sidebar navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-[#ef233c]/15 via-[#ef233c]/10 to-transparent text-[#dc2626] shadow-[inset_3px_0_0_#ff2a3c] dark:from-[#ef233c]/30 dark:via-[#ef233c]/15 dark:text-white'
                      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground dark:hover:bg-white/[0.04]',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Promo Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-secondary/50 to-[#ef233c]/10 p-4 text-center dark:border-white/[0.08] dark:from-white/[0.04] dark:to-[#ef233c]/15">
          <div className="mx-auto grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Crown className="size-4" />
          </div>
          <p className="mt-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Fast · Easy · Free
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Download YouTube videos &amp; audio in one click!
          </p>
        </div>
      </aside>

      {/* Main Content + Bottom Status Bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-card/90 px-4 py-2.5 text-xs text-muted-foreground dark:border-white/[0.06] dark:bg-[#0e1015]/90 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  activeJob ? 'animate-pulse bg-[#ff2a3c]' : 'bg-emerald-500',
                )}
              />
              <span>
                {activeJob
                  ? `Downloading (${Math.round(activeJob.progress)}%)`
                  : 'Ready to Download'}
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <Download className="size-3 opacity-70" />
                {activeSpeed}
              </span>
              <span className="h-3 w-px bg-border dark:bg-white/10" />
              <span className="inline-flex items-center gap-1.5">
                <Globe className={cn('size-3', connected ? 'text-emerald-500' : 'opacity-50')} />
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </footer>
      </div>

      <Toaster />
    </div>
  );
}
