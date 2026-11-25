import { useEffect } from 'react';
import { AudioLines, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PlayableMedia {
  title: string;
  src: string;
  downloadUrl: string;
  format: 'mp3' | 'mp4';
  thumbnail?: string | null;
}

export function PlayerModal({
  media,
  onClose,
}: {
  media: PlayableMedia | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media, onClose]);

  if (!media) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${media.title}`}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-white/10 dark:bg-[#13161f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 dark:border-white/[0.08]">
          <p className="truncate text-sm font-semibold text-foreground">{media.title}</p>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <a href={media.downloadUrl} download>
                <Download className="size-3.5" />
                Save
              </a>
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {media.format === 'mp4' ? (
            <video
              src={media.src}
              controls
              autoPlay
              playsInline
              className="max-h-[72vh] w-full rounded-xl bg-black"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              {media.thumbnail ? (
                <img
                  src={media.thumbnail}
                  alt={media.title}
                  referrerPolicy="no-referrer"
                  className="h-44 w-72 rounded-xl object-cover shadow-lg"
                />
              ) : (
                <div className="grid size-24 place-items-center rounded-2xl bg-[#ff2a3c]/15 text-[#ff2a3c]">
                  <AudioLines className="size-10" />
                </div>
              )}
              <audio src={media.src} controls autoPlay className="w-full max-w-md" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
