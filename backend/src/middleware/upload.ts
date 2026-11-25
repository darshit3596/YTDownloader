import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config';
import { AppError } from './error-handler';
import { storagePaths } from '../utils/paths';
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  isAllowedMediaExtension,
  isAllowedMediaMime,
} from '../utils/files';

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, storagePaths.uploads);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!isAllowedMediaExtension(file.originalname)) {
      callback(new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'That file extension is not allowed.'), '');
      return;
    }
    callback(null, `${randomUUID()}${extension}`);
  },
});

export const uploadSingleMedia = multer({
  storage,
  limits: {
    fileSize: config.limits.maxUploadBytes,
    files: 1,
    fields: 4,
    parts: 6,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedMediaExtension(file.originalname)) {
      callback(
        new AppError(
          400,
          'UNSUPPORTED_FILE_TYPE',
          `Unsupported file extension. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`,
        ),
      );
      return;
    }
    if (!isAllowedMediaMime(file.mimetype)) {
      callback(
        new AppError(
          415,
          'UNSUPPORTED_MIME_TYPE',
          `Unsupported media type "${file.mimetype}". Allowed types are audio, video and generic binary streams (${ALLOWED_UPLOAD_MIME_TYPES.slice(0, 4).join(', ')}…).`,
        ),
      );
      return;
    }
    callback(null, true);
  },
}).single('file');
