import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { AppError } from '../../utils/app-error.js';
import { resolveMediaTypePolicy } from './media.policy.js';

export interface MediaUploadMiddlewareOptions {
  stagingDirectory: string;
  maximumSizeBytes: number;
}

function mapMulterError(error: MulterError): AppError {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      'Yuklangan fayl ruxsat etilgan hajmdan katta.',
      413,
      'MEDIA_FILE_TOO_LARGE',
    );
  }

  return new AppError(
    'Faqat bitta faylni “file” maydonida yuboring.',
    422,
    'MEDIA_MULTIPART_INVALID',
  );
}

export function createMediaUploadMiddleware(options: MediaUploadMiddlewareOptions): RequestHandler {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        void mkdir(options.stagingDirectory, { recursive: true })
          .then(() => callback(null, options.stagingDirectory))
          .catch((error: unknown) => callback(error as Error, options.stagingDirectory));
      },
      filename: (_request, _file, callback) => {
        callback(null, `${randomUUID()}.upload`);
      },
    }),
    limits: {
      fileSize: options.maximumSizeBytes,
      files: 1,
      fields: 0,
      parts: 2,
    },
    fileFilter: (_request, file, callback) => {
      try {
        resolveMediaTypePolicy(file.originalname, file.mimetype);
        callback(null, true);
      } catch (error: unknown) {
        callback(error as Error);
      }
    },
  }).single('file');

  return (request, response, next) => {
    upload(request, response, (error: unknown) => {
      if (error instanceof MulterError) {
        next(mapMulterError(error));
        return;
      }
      next(error);
    });
  };
}
