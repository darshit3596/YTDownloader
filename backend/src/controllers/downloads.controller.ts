import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import mime from 'mime-types';
import { prisma } from '../database/prisma';
import { notFound, conflict } from '../middleware/error-handler';
import { resolveDownloadPath } from '../services/history.service';

function contentDisposition(fileName: string, inline = false): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function downloadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw notFound('That job does not exist.', 'JOB_NOT_FOUND');
    if (job.status !== 'completed') {
      throw conflict('This job has not produced a downloadable file yet.', 'FILE_NOT_READY');
    }

    const filePath = resolveDownloadPath(job.outputPath);
    const stat = await fs.promises.stat(filePath);
    const fileName = path.basename(job.fileName ?? filePath);
    const contentType = mime.lookup(fileName) || 'application/octet-stream';

    const inline = req.query.inline === '1' || req.query.inline === 'true';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(fileName, inline));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!match || (!match[1] && !match[2]) || stat.size === 0) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
        res.end();
        return;
      }
      let start: number;
      let end: number;
      if (!match[1] && match[2]) {
        // Suffix byte range: bytes=-N means the last N bytes.
        const suffixLength = Number.parseInt(match[2], 10);
        if (Number.isNaN(suffixLength) || suffixLength <= 0) {
          res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
          res.end();
          return;
        }
        start = Math.max(0, stat.size - suffixLength);
        end = stat.size - 1;
      } else {
        start = Number.parseInt(match[1], 10);
        end = match[2] ? Math.min(Number.parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
      }
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end >= stat.size ||
        start > end
      ) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
        res.end();
        return;
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', String(end - start + 1));

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', next);
      res.on('close', () => stream.destroy());
      stream.pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(stat.size));
    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
