import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecureMediaFileInspector } from '../../src/modules/media/media.inspector.js';
import { resolveMediaTypePolicy } from '../../src/modules/media/media.policy.js';

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('SecureMediaFileInspector', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'turk-tili-media-inspector-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('accepts a matching signature and calculates SHA-256', async () => {
    const path = join(directory, 'upload.tmp');
    await writeFile(path, pngBytes);
    const { originalFileName, policy } = resolveMediaTypePolicy('rasm.png', 'image/png');

    const inspected = await new SecureMediaFileInspector(1_024).inspect(
      {
        path,
        originalFileName,
        declaredMimeType: 'image/png',
        sizeBytes: pngBytes.length,
      },
      originalFileName,
      policy,
    );

    expect(inspected).toMatchObject({
      originalFileName: 'rasm.png',
      mimeType: 'image/png',
      extension: 'png',
      sizeBytes: pngBytes.length,
      checksum: createHash('sha256').update(pngBytes).digest('hex'),
    });
  });

  it('rejects an empty file', async () => {
    const path = join(directory, 'empty.tmp');
    await writeFile(path, Buffer.alloc(0));
    const { originalFileName, policy } = resolveMediaTypePolicy('rasm.png', 'image/png');

    await expect(
      new SecureMediaFileInspector(1_024).inspect(
        {
          path,
          originalFileName,
          declaredMimeType: 'image/png',
          sizeBytes: 0,
        },
        originalFileName,
        policy,
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_FILE_EMPTY' });
  });

  it('rejects a real signature that does not match the extension', async () => {
    const path = join(directory, 'mismatch.tmp');
    await writeFile(path, pngBytes);
    const { originalFileName, policy } = resolveMediaTypePolicy('rasm.jpg', 'image/jpeg');

    await expect(
      new SecureMediaFileInspector(1_024).inspect(
        {
          path,
          originalFileName,
          declaredMimeType: 'image/jpeg',
          sizeBytes: pngBytes.length,
        },
        originalFileName,
        policy,
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_SIGNATURE_MISMATCH' });
  });

  it('enforces the configured maximum size independently of multipart parsing', async () => {
    const path = join(directory, 'large.tmp');
    await writeFile(path, pngBytes);
    const { originalFileName, policy } = resolveMediaTypePolicy('rasm.png', 'image/png');

    await expect(
      new SecureMediaFileInspector(8).inspect(
        {
          path,
          originalFileName,
          declaredMimeType: 'image/png',
          sizeBytes: pngBytes.length,
        },
        originalFileName,
        policy,
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_FILE_TOO_LARGE', statusCode: 413 });
  });
});
