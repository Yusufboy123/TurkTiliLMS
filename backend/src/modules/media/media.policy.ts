import { extname, posix } from 'node:path';
import { MediaCategory } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import { declaredMediaMetadataSchema } from './media.schemas.js';
import type { MediaTypePolicy } from './media.types.js';

const mediaPolicies = {
  jpg: {
    category: MediaCategory.IMAGE,
    extension: 'jpg',
    canonicalMimeType: 'image/jpeg',
    acceptedDeclaredMimeTypes: ['image/jpeg'],
    acceptedDetectedExtensions: ['jpg'],
  },
  jpeg: {
    category: MediaCategory.IMAGE,
    extension: 'jpeg',
    canonicalMimeType: 'image/jpeg',
    acceptedDeclaredMimeTypes: ['image/jpeg'],
    acceptedDetectedExtensions: ['jpg'],
  },
  png: {
    category: MediaCategory.IMAGE,
    extension: 'png',
    canonicalMimeType: 'image/png',
    acceptedDeclaredMimeTypes: ['image/png'],
    acceptedDetectedExtensions: ['png'],
  },
  webp: {
    category: MediaCategory.IMAGE,
    extension: 'webp',
    canonicalMimeType: 'image/webp',
    acceptedDeclaredMimeTypes: ['image/webp'],
    acceptedDetectedExtensions: ['webp'],
  },
  pdf: {
    category: MediaCategory.DOCUMENT,
    extension: 'pdf',
    canonicalMimeType: 'application/pdf',
    acceptedDeclaredMimeTypes: ['application/pdf'],
    acceptedDetectedExtensions: ['pdf'],
  },
  doc: {
    category: MediaCategory.DOCUMENT,
    extension: 'doc',
    canonicalMimeType: 'application/msword',
    acceptedDeclaredMimeTypes: ['application/msword'],
    acceptedDetectedExtensions: ['doc', 'cfb'],
  },
  docx: {
    category: MediaCategory.DOCUMENT,
    extension: 'docx',
    canonicalMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    acceptedDeclaredMimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    acceptedDetectedExtensions: ['docx'],
  },
  ppt: {
    category: MediaCategory.DOCUMENT,
    extension: 'ppt',
    canonicalMimeType: 'application/vnd.ms-powerpoint',
    acceptedDeclaredMimeTypes: ['application/vnd.ms-powerpoint'],
    acceptedDetectedExtensions: ['ppt', 'cfb'],
  },
  pptx: {
    category: MediaCategory.DOCUMENT,
    extension: 'pptx',
    canonicalMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    acceptedDeclaredMimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    acceptedDetectedExtensions: ['pptx'],
  },
  mp3: {
    category: MediaCategory.AUDIO,
    extension: 'mp3',
    canonicalMimeType: 'audio/mpeg',
    acceptedDeclaredMimeTypes: ['audio/mpeg', 'audio/mp3'],
    acceptedDetectedExtensions: ['mp3'],
  },
  wav: {
    category: MediaCategory.AUDIO,
    extension: 'wav',
    canonicalMimeType: 'audio/wav',
    acceptedDeclaredMimeTypes: ['audio/wav', 'audio/x-wav'],
    acceptedDetectedExtensions: ['wav'],
  },
  mp4: {
    category: MediaCategory.VIDEO,
    extension: 'mp4',
    canonicalMimeType: 'video/mp4',
    acceptedDeclaredMimeTypes: ['video/mp4'],
    acceptedDetectedExtensions: ['mp4'],
  },
} as const satisfies Record<string, MediaTypePolicy>;

export const supportedMediaExtensions = Object.freeze(Object.keys(mediaPolicies));

export function normalizeOriginalFileName(value: string): string {
  const normalized = value.replaceAll('\\', '/').normalize('NFC');
  return posix.basename(normalized);
}

export function resolveMediaTypePolicy(
  originalFileName: string,
  declaredMimeType: string,
): { originalFileName: string; policy: MediaTypePolicy } {
  const parsed = declaredMediaMetadataSchema.parse({
    originalFileName: normalizeOriginalFileName(originalFileName),
    mimeType: declaredMimeType,
  });
  const extension = extname(parsed.originalFileName).slice(1).toLowerCase();
  const policy = mediaPolicies[extension as keyof typeof mediaPolicies];

  if (!policy) {
    throw new AppError(
      `Fayl kengaytmasi qo‘llab-quvvatlanmaydi. Ruxsat etilgan turlar: ${supportedMediaExtensions.join(', ')}.`,
      422,
      'MEDIA_EXTENSION_NOT_SUPPORTED',
    );
  }

  if (!(policy.acceptedDeclaredMimeTypes as readonly string[]).includes(parsed.mimeType)) {
    throw new AppError(
      'Fayl MIME turi uning kengaytmasiga mos emas.',
      422,
      'MEDIA_MIME_TYPE_MISMATCH',
    );
  }

  return {
    originalFileName: parsed.originalFileName,
    policy,
  };
}
