import { motion } from 'framer-motion';
import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage({ action }: { action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <motion.p
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-gradient font-mono text-7xl font-bold tracking-tighter"
      >
        404
      </motion.p>
      <div className="mt-4 grid size-11 place-items-center rounded-xl border border-border/70 bg-secondary/50 text-primary">
        <Compass className="size-5" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">This route doesn’t exist</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The page you were looking for may have moved. Head back to the workspace to continue
        converting authorized media.
      </p>
      <div className="mt-6 flex items-center gap-2">
        {action ?? (
          <Button asChild>
            <Link to="/">
              <Home className="size-4" />
              Back to home
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
