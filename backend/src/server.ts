import http from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { initSocket, closeSocket } from './socket';
import { jobRunner } from './services/job-runner';
import { startCleanupScheduler, stopCleanupScheduler } from './services/cleanup.service';
import { getSettings } from './services/settings.service';
import { getToolStatus, setConfiguredFfmpegPath } from './services/ffmpeg.service';
import { disconnectPrisma } from './database/prisma';
import { createLogger } from './utils/logger';
import { setConfiguredDownloadDir, storagePaths } from './utils/paths';

const logger = createLogger('server');

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  await jobRunner.init();
  startCleanupScheduler();

  const settings = await getSettings().catch(() => null);
  setConfiguredFfmpegPath(settings?.ffmpegPath);
  if (settings?.downloadDir) {
    try {
      setConfiguredDownloadDir(settings.downloadDir);
    } catch {
      logger.warn('saved downloadDir unavailable, using default', { downloadDir: settings.downloadDir });
    }
  }
  await getToolStatus(settings?.ffmpegPath || undefined).catch(() => null);

  logger.info('storage ready', storagePaths);

  server.listen(config.port, () => {
    logger.info(`MediaFlow API listening on http://localhost:${config.port}`);
    logger.info(`Allowed origins: ${config.clientOrigins.join(', ') || '(same-origin only)'}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`received ${signal} — shutting down gracefully`);

    stopCleanupScheduler();
    try {
      await jobRunner.shutdown();
    } catch (error) {
      logger.warn('queue shutdown error', (error as Error).message);
    }

    try {
      closeSocket();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, 8000).unref?.();
      });
    } catch (error) {
      logger.warn('http shutdown error', (error as Error).message);
    }

    await disconnectPrisma().catch(() => undefined);
    logger.info('shutdown complete');
    setTimeout(() => process.exit(0), 150).unref?.();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled promise rejection', reason);
  });
}

main().catch((error) => {
  logger.error('fatal startup error', error);
  process.exit(1);
});
