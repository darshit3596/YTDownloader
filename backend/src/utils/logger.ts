type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  const time = new Date().toISOString();
  const prefix = `[${time}] [${level.toUpperCase()}] [${scope}]`;
  if (level === 'error') {
    console.error(prefix, message, meta ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, message, meta ?? '');
  } else if (process.env.NODE_ENV !== 'test' || level === 'info') {
    console.log(prefix, message, meta ?? '');
  }
}

export function createLogger(scope: string) {
  return {
    info: (message: string, meta?: unknown) => emit('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => emit('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => emit('error', scope, message, meta),
    debug: (message: string, meta?: unknown) => {
      if (process.env.NODE_ENV !== 'production') emit('debug', scope, message, meta);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
