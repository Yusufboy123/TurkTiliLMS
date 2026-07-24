import { MediaCategory } from '@prisma/client';
import { presentMediaReference } from '../../src/modules/media/media-reference.presenter.js';
import { MEDIA_ID, publicMediaReference } from '../helpers/media-fakes.js';

function payload(overrides: Record<string, unknown> = {}) {
  const reference = publicMediaReference();
  return {
    id: reference.id,
    originalFileName: reference.originalFileName,
    mimeType: reference.mimeType,
    extension: reference.extension,
    category: reference.category,
    sizeBytes: 67n,
    checksum: reference.checksum,
    storageProvider: reference.storageProvider,
    deletedAt: reference.deletedAt,
    ...overrides,
  };
}

describe('media reference presenter', () => {
  it('exposes only safe media metadata and relative delivery URLs', () => {
    const result = presentMediaReference(payload());

    expect(result).toMatchObject({
      id: MEDIA_ID,
      sizeBytes: '67',
      downloadUrl: `/api/v1/media/${MEDIA_ID}/download`,
      previewUrl: `/api/v1/media/${MEDIA_ID}/download`,
    });
    expect(result).not.toHaveProperty('storedFileName');
    expect(result).not.toHaveProperty('storagePath');
  });

  it('does not offer preview for non-PDF documents', () => {
    const result = presentMediaReference(
      payload({
        category: MediaCategory.DOCUMENT,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      }),
    );
    expect(result?.downloadUrl).toBe(`/api/v1/media/${MEDIA_ID}/download`);
    expect(result?.previewUrl).toBeNull();
  });

  it('removes delivery URLs when a legacy relation points to deleted media', () => {
    const result = presentMediaReference(payload({ deletedAt: new Date() }));
    expect(result?.downloadUrl).toBeNull();
    expect(result?.previewUrl).toBeNull();
  });
});
