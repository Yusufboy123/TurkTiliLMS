import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaCategory } from '@prisma/client';
import { LocalMediaStorage, MediaStoragePathError } from '../../src/modules/media/media.storage.js';

describe('LocalMediaStorage', () => {
  let rootDirectory: string;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), 'turk-tili-media-storage-'));
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it('moves a staged file into its category with a UUID filename', async () => {
    const storage = new LocalMediaStorage(rootDirectory);
    await storage.initialize();
    const stagedPath = join(storage.stagingDirectory, 'incoming.upload');
    await writeFile(stagedPath, Buffer.from('media'));

    const stored = await storage.store(
      {
        path: stagedPath,
        originalFileName: 'rasm.jpg',
        declaredMimeType: 'image/jpeg',
        sizeBytes: 5,
      },
      {
        originalFileName: 'rasm.jpg',
        category: MediaCategory.IMAGE,
        extension: 'jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
        checksum: 'a'.repeat(64),
      },
    );

    expect(stored.storedFileName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/u,
    );
    expect(stored.storagePath).toBe(`images/${stored.storedFileName}`);

    const opened = await storage.open(stored.storagePath);
    expect(opened.contentLength).toBe(5);
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe('media');
  });

  it('rejects paths outside the configured storage root', async () => {
    const storage = new LocalMediaStorage(rootDirectory);
    await expect(storage.open('../secret.txt')).rejects.toBeInstanceOf(MediaStoragePathError);
    await expect(storage.discardStaged(join(rootDirectory, 'outside.tmp'))).rejects.toBeInstanceOf(
      MediaStoragePathError,
    );
  });
});
