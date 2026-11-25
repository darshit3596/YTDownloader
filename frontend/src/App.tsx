import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { DownloaderPage } from '@/pages/downloader-page';
import { JobsPage } from '@/pages/jobs-page';
import { HistoryPage } from '@/pages/history-page';
import { SettingsPage } from '@/pages/settings-page';
import { DocsPage } from '@/pages/docs-page';
import { NotFoundPage } from '@/pages/not-found-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DownloaderPage />} />
        <Route path="downloader" element={<Navigate to="/" replace />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route
          path="*"
          element={
            <NotFoundPage
              action={
                <Link
                  to="/"
                  className="inline-flex h-10 items-center rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-glow-sm"
                >
                  Back to home
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  );
}
