import type { Prisma } from '@prisma/client';

export const mediaReferenceSelect = {
  id: true,
  originalFileName: true,
  mimeType: true,
  extension: true,
  category: true,
  sizeBytes: true,
  checksum: true,
  storageProvider: true,
  deletedAt: true,
} satisfies Prisma.MediaFileSelect;

export type MediaReferencePayload = Prisma.MediaFileGetPayload<{
  select: typeof mediaReferenceSelect;
}>;

export interface PublicMediaReference {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  category: MediaReferencePayload['category'];
  sizeBytes: string;
  checksum: string | null;
  storageProvider: MediaReferencePayload['storageProvider'];
  downloadUrl: string | null;
  previewUrl: string | null;
  deletedAt: Date | null;
}

function supportsPreview(media: MediaReferencePayload): boolean {
  return (
    media.category === 'IMAGE' ||
    media.category === 'VIDEO' ||
    media.category === 'AUDIO' ||
    (media.category === 'DOCUMENT' &&
      media.extension === 'pdf' &&
      media.mimeType === 'application/pdf')
  );
}

export function presentMediaReference(
  media: MediaReferencePayload | null,
): PublicMediaReference | null {
  if (!media) return null;

  const downloadUrl = media.deletedAt ? null : `/api/v1/media/${media.id}/download`;
  return {
    id: media.id,
    originalFileName: media.originalFileName,
    mimeType: media.mimeType,
    extension: media.extension,
    category: media.category,
    sizeBytes: media.sizeBytes.toString(),
    checksum: media.checksum,
    storageProvider: media.storageProvider,
    downloadUrl,
    previewUrl: downloadUrl && supportsPreview(media) ? downloadUrl : null,
    deletedAt: media.deletedAt,
  };
}
