import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  Database,
  FolderTree,
  KeyRound,
  ListTree,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const endpoints = [
  { method: 'POST', path: '/api/media/analyze', description: 'Analyze a direct URL or YouTube link (metadata only).' },
  { method: 'POST', path: '/api/media/upload', description: 'Upload a local audio/video file as multipart form data.' },
  { method: 'GET', path: '/api/media/:id', description: 'Fetch stored metadata and the output-option matrix.' },
  { method: 'POST', path: '/api/conversions', description: 'Queue an MP3/MP4 conversion for an analyzed media item.' },
  { method: 'GET', path: '/api/jobs', description: 'List persisted jobs, newest first.' },
  { method: 'GET', path: '/api/jobs/:id', description: 'Fetch a single job with live progress fields.' },
  { method: 'POST', path: '/api/jobs/:id/cancel', description: 'Cancel a queued or running FFmpeg process.' },
  { method: 'POST', path: '/api/jobs/:id/retry', description: 'Re-queue a failed or cancelled job.' },
  { method: 'GET', path: '/api/jobs/queue/status', description: 'Current worker pool statistics.' },
  { method: 'GET', path: '/api/downloads/:id', description: 'Stream the finished file with HTTP Range support.' },
  { method: 'GET', path: '/api/history', description: 'List completed-conversion history entries.' },
  { method: 'DELETE', path: '/api/history/:id', description: 'Delete an entry and its output file.' },
  { method: 'GET', path: '/api/settings', description: 'Read persisted application settings.' },
  { method: 'PUT', path: '/api/settings', description: 'Update settings; concurrency applies immediately.' },
  { method: 'GET', path: '/api/system/status', description: 'FFmpeg/FFprobe detection, storage usage and queue state.' },
];

const envVars = [
  { name: 'PORT', value: '4000', description: 'API port (the frontend dev server proxies to it).' },
  { name: 'DATABASE_URL', value: 'file:../../storage/mediaflow.db', description: 'SQLite location relative to the Prisma schema.' },
  { name: 'STORAGE_ROOT', value: '(blank)', description: 'Override the storage directory used for uploads, outputs and temp files.' },
  { name: 'FFMPEG_PATH', value: '(blank)', description: 'Custom ffmpeg binary; blank uses the bundled ffmpeg-static build.' },
  { name: 'FFPROBE_PATH', value: '(blank)', description: 'Custom ffprobe binary; inferred from FFMPEG_PATH when omitted.' },
  { name: 'YOUTUBE_API_KEY', value: '(blank)', description: 'Enables official YouTube Data API v3 metadata lookups.' },
  { name: 'CLIENT_ORIGIN', value: 'http://localhost:5173,…', description: 'Comma-separated CORS allow-list for the browser client.' },
  { name: 'MAX_CONCURRENT_JOBS', value: '2', description: 'Default worker pool size before settings are saved.' },
  { name: 'MAX_UPLOAD_MB', value: '512', description: 'Per-file upload cap enforced by multer and the frontend.' },
  { name: 'MAX_REMOTE_FILE_MB', value: '1024', description: 'Maximum size of a remote direct-URL download.' },
];

function DocCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Terminal;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/50">
      <div className="flex items-center gap-2.5 border-b border-border/60 p-4 sm:p-5">
        <div className="grid size-8 place-items-center rounded-lg bg-secondary/60 text-primary">
          <Icon className="size-4" />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const methodVariant = (method: string) => {
  if (method === 'POST') return 'default';
  if (method === 'DELETE') return 'destructive';
  if (method === 'PUT') return 'accent';
  return 'outline';
};

export function DocsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Reference"
        title="Documentation"
        description="Install, configure and operate MediaFlow Web. Everything runs locally: the API, the SQLite ledger, FFmpeg and your output files."
        actions={
          <Button asChild size="sm">
            <Link to="/downloader">
              Open downloader
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-4">
        <DocCard icon={Terminal} title="Quick start">
          <ol className="space-y-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1. Install dependencies.</span>
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11.5px] text-foreground/90">
                npm install{'\n'}npm run install:all
              </pre>
            </li>
            <li>
              <span className="font-semibold text-foreground">2. Create the SQLite schema.</span>
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11.5px] text-foreground/90">
                npm run db:push
              </pre>
            </li>
            <li>
              <span className="font-semibold text-foreground">3. Run in development.</span>
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11.5px] text-foreground/90">
                npm run dev
              </pre>
              <p className="mt-1.5">
                Vite serves the UI on <code className="font-mono text-foreground/80">http://localhost:5173</code> and
                proxies <code className="font-mono text-foreground/80">/api</code> plus Socket.IO to the API on port
                4000.
              </p>
            </li>
            <li>
              <span className="font-semibold text-foreground">4. Build and self-host.</span>
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11.5px] text-foreground/90">
                npm run build{'\n'}npm start
              </pre>
              <p className="mt-1.5">
                The backend serves the compiled frontend from{' '}
                <code className="font-mono text-foreground/80">frontend/dist</code> on the API origin.
              </p>
            </li>
          </ol>
        </DocCard>

        <DocCard icon={KeyRound} title="Environment variables">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Copy <code className="font-mono text-foreground/80">backend/.env.example</code> to{' '}
            <code className="font-mono text-foreground/80">backend/.env</code> and adjust as needed. Secrets stay on
            the server — the frontend never receives the YouTube key or filesystem paths.
          </p>
          <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
            {envVars.map((variable) => (
              <div key={variable.name} className="bg-background/30 px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <code className="font-mono text-[11.5px] font-semibold text-foreground">{variable.name}</code>
                  <span className="font-mono text-[10.5px] text-muted-foreground/80">{variable.value}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{variable.description}</p>
              </div>
            ))}
          </div>
        </DocCard>

        <DocCard icon={ListTree} title="REST API">
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
            {endpoints.map((endpoint) => (
              <div
                key={`${endpoint.method}-${endpoint.path}`}
                className="flex flex-col gap-1 bg-background/30 px-3.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <Badge variant={methodVariant(endpoint.method)} className="w-fit font-mono text-[9.5px]">
                  {endpoint.method}
                </Badge>
                <code className="font-mono text-[11.5px] text-foreground/90">{endpoint.path}</code>
                <span className="text-[11px] leading-relaxed text-muted-foreground sm:ml-auto sm:text-right">
                  {endpoint.description}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Errors use a stable envelope:{' '}
            <code className="font-mono text-foreground/80">{'{ error: { code, message, details? } }'}</code>. Socket.IO
            emits <code className="font-mono text-foreground/80">job:created</code>,{' '}
            <code className="font-mono text-foreground/80">job:update</code> and{' '}
            <code className="font-mono text-foreground/80">queue:stats</code> on the same origin.
          </p>
        </DocCard>

        <DocCard icon={ShieldCheck} title="Security model">
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <li>• Outbound URLs are protocol-checked, credential-free and DNS-resolved first; every answer must be public (IPv4 and IPv6, including mapped forms).</li>
            <li>• Redirects are re-validated at each hop, and remote downloads are size-capped and streamed to disk.</li>
            <li>• Uploads are extension-, MIME- and container-checked; filenames are sanitized and stored under random UUIDs.</li>
            <li>• Downloads resolve only inside the storage directory, with path-traversal checks and attachment headers.</li>
            <li>• FFmpeg/FFprobe are spawned with argument arrays, never a shell string; temp files are cleaned on cancel, failure and on a schedule.</li>
            <li>• Helmet headers, explicit CORS allow-list, body limits and per-route rate limits are enabled by default.</li>
          </ul>
        </DocCard>

        <DocCard icon={FolderTree} title="Storage layout">
          <pre className="overflow-x-auto rounded-lg border border-border/70 bg-background/60 p-3 font-mono text-[11.5px] leading-relaxed text-foreground/90">
{`mediaflow-web/
  storage/
    mediaflow.db      # SQLite ledger (never media blobs)
    uploads/          # sanitized source uploads
    downloads/        # finished MP3/MP4 outputs
    temp/             # streamed remote sources + scratch space`}
          </pre>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Deleting a history entry removes its output file. The cleanup sweeper removes expired temp files and, when
            “Keep original uploads” is disabled, stale source uploads.
          </p>
        </DocCard>

        <DocCard icon={Boxes} title="Limits & troubleshooting">
          <div className="space-y-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">FFmpeg not detected.</span> Run{' '}
              <code className="font-mono text-foreground/80">npm install</code> in{' '}
              <code className="font-mono text-foreground/80">backend</code> so the bundled binaries are present, or set{' '}
              <code className="font-mono text-foreground/80">FFMPEG_PATH</code> to a full binary path.
            </p>
            <p>
              <span className="font-semibold text-foreground">YouTube lookups fail.</span> Metadata requires{' '}
              <code className="font-mono text-foreground/80">YOUTUBE_API_KEY</code>. YouTube links are intentionally
              metadata-only; conversions are disabled for them.
            </p>
            <p>
              <span className="font-semibold text-foreground">A 4K option is disabled.</span> Upscaling is never
              performed. The option is enabled only when the source is at least that tall.
            </p>
            <p>
              <span className="font-semibold text-foreground">Uploads rejected.</span> Check the extension allow-list
              and the <code className="font-mono text-foreground/80">MAX_UPLOAD_MB</code> cap. Text files are rejected
              even when FFprobe can technically parse them.
            </p>
          </div>
        </DocCard>

        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card/40 px-4 py-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Database className="size-3.5" />
            Full setup notes, architecture and API examples live in the repository README.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">Open system diagnostics</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
