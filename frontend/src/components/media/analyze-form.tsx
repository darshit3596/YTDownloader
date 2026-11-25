import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CircleSlash, CloudUpload, Copy, Loader2, Link2, Sparkles, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMediaStore } from '@/store/media-store';
import { toast } from '@/store/toast-store';
import { cn, formatBytes, isYouTubeUrl } from '@/lib/utils';
import { validateMediaUrl } from '@/lib/validation';

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.opus',
];

function SourceBadge({ url }: { url: string }) {
  if (!url.trim()) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {isYouTubeUrl(url) ? (
        <>
          <Sparkles className="size-3 text-accent" />
          YouTube URL detected — MP3 / MP4 download
        </>
      ) : (
        <>
          <Link2 className="size-3 text-primary" />
          Direct media URL
        </>
      )}
    </span>
  );
}

export function AnalyzeForm({
  compact = false,
  onAnalyzed,
  className,
}: {
  compact?: boolean;
  onAnalyzed?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const media = useMediaStore((s) => s.media);
  const analyzing = useMediaStore((s) => s.analyzing);
  const uploading = useMediaStore((s) => s.uploading);
  const uploadProgress = useMediaStore((s) => s.uploadProgress);
  const error = useMediaStore((s) => s.error);
  const analyze = useMediaStore((s) => s.analyze);
  const upload = useMediaStore((s) => s.upload);
  const clear = useMediaStore((s) => s.clear);

  const busy = analyzing || uploading;

  const handleAnalyze = async () => {
    const value = url.trim();
    const guard = validateMediaUrl(value);
    if (!guard.ok) {
      setUrlError(guard.message ?? 'Invalid URL.');
      return;
    }
    setUrlError(null);
    const result = await analyze(value);
    if (result) {
      toast.success(
        'Media analyzed',
        `${result.title} is ready for conversion.`,
      );
      onAnalyzed?.();
      if (location.pathname !== '/downloader') {
        navigate('/downloader', { state: { mediaId: result.id }, replace: false });
      }
    } else {
      const message = useMediaStore.getState().error ?? 'Unable to analyze this URL.';
      toast.error('Analysis failed', message);
    }
  };

  const pickFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        toast.error('Unsupported file type', `Accepted types: ${ACCEPTED_EXTENSIONS.join(', ')}`);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error('File too large', `Maximum upload size is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
        return;
      }
      setSelectedFile(file);
      const result = await upload(file);
      if (result) {
        toast.success('Upload complete', `${result.title} was analyzed successfully.`);
        onAnalyzed?.();
        if (location.pathname !== '/downloader') {
          navigate('/downloader', { state: { mediaId: result.id } });
        }
      } else {
        toast.error('Upload failed', useMediaStore.getState().error ?? 'Please try again.');
      }
    },
    [location.pathname, navigate, onAnalyzed, upload],
  );

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setUrlError(null);
      }
    } catch {
      toast.info('Clipboard unavailable', 'Paste the URL manually with Ctrl+V.');
    }
  };

  const handleClear = () => {
    setUrl('');
    setUrlError(null);
    setSelectedFile(null);
    clear();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={cn('w-full', className)}>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="url">
              <Link2 className="size-3.5" /> Media URL
            </TabsTrigger>
            <TabsTrigger value="upload">
              <CloudUpload className="size-3.5" /> Upload file
            </TabsTrigger>
          </TabsList>
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
            <CheckCircle2 className="size-3.5 text-success" />
            Authorized sources only
          </span>
        </div>

        <TabsContent value="url" className="mt-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleAnalyze();
            }}
          >
            <div
              className={cn(
                'group flex flex-col gap-2 rounded-2xl border border-border/80 bg-background/50 p-2 shadow-inner transition-colors sm:flex-row sm:items-center',
                'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
                urlError && 'border-destructive/60 focus-within:border-destructive/60',
              )}
            >
              <div className="relative flex flex-1 items-center">
                <Link2 className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  placeholder="Paste a direct media URL or YouTube link…"
                  aria-label="Media URL"
                  aria-invalid={Boolean(urlError)}
                  className="h-11 border-0 bg-transparent pl-9 pr-16 shadow-none focus-visible:ring-0"
                  disabled={busy}
                  spellCheck={false}
                  autoComplete="off"
                />
                <div className="absolute right-1.5 flex items-center gap-0.5">
                  {url && (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Clear URL"
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void pasteFromClipboard()}
                    aria-label="Paste from clipboard"
                    className="hidden size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:grid"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-11 shrink-0 rounded-xl px-5"
                loading={analyzing}
                disabled={busy || !url.trim()}
              >
                {!analyzing && <Sparkles className="size-4" />}
                {analyzing ? 'Analyzing…' : 'Analyze'}
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
              <SourceBadge url={url} />
              <span className="text-[11px] text-muted-foreground">
                Max 512 MB uploads · MP3 / MP4 output
              </span>
            </div>
          </form>

          {(urlError || (error && !uploading)) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
            >
              <CircleSlash className="mt-0.5 size-3.5 shrink-0" />
              <span className="leading-relaxed">{urlError ?? error}</span>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void pickFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              'group relative flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 px-4 py-6 text-center transition-all',
              dragActive
                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                : 'hover:border-primary/50 hover:bg-primary/[0.04]',
              uploading && 'pointer-events-none',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="sr-only"
              onChange={(event) => void pickFile(event.target.files?.[0])}
            />
            <div className="grid size-11 place-items-center rounded-xl border border-border/70 bg-secondary/60 text-primary transition-transform group-hover:scale-105">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <CloudUpload className="size-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {uploading
                  ? `Uploading ${selectedFile?.name ?? 'file'}…`
                  : 'Drop your media file here'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                MP4, MOV, WEBM, MKV, AVI, MP3, WAV, M4A, FLAC · up to 512 MB
              </p>
            </div>
            {uploading && (
              <div className="mt-2 w-full max-w-xs">
                <Progress value={uploadProgress} />
                <p className="mt-1.5 text-[11px] tabular text-muted-foreground">
                  {uploadProgress}% uploaded
                </p>
              </div>
            )}
            <span className="text-[11px] font-medium text-primary">Browse files</span>
          </div>

          {selectedFile && !uploading && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs">
              <span className="truncate text-muted-foreground">
                {selectedFile.name} · {formatBytes(selectedFile.size)}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove selected file"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {error && !uploading && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <CircleSlash className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {!compact && media && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/[0.06] px-3 py-2.5">
          <span className="truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{media.title}</span> loaded
          </span>
          <Button
            size="sm"
            variant="subtle"
            className="h-7 shrink-0 text-[11px]"
            onClick={() => navigate('/downloader')}
          >
            Choose format
          </Button>
        </div>
      )}
    </div>
  );
}
