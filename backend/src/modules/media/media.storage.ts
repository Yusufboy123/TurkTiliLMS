import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { MediaStorageProvider } from '@prisma/client';
import type { MediaCategory } from '@prisma/client';
import type { Readable } from 'node:stream';
import type { InspectedMediaUpload, StagedMediaUpload, StoredMediaObject } from './media.types.js';

const categoryDirectories: Record<MediaCategory, string> = {
  IMAGE: 'images',
  DOCUMENT: 'documents',
  AUDIO: 'audio',
  VIDEO: 'video',
};

export class MediaStorageObjectNotFoundError extends Error {
  constructor() {
    super('Stored media object was not found.');
    this.name = 'MediaStorageObjectNotFoundError';
  }
}

export class MediaStoragePathError extends Error {
  constructor() {
    super('Storage path is outside the configured media root.');
    this.name = 'MediaStoragePathError';
  }
}

export interface MediaStorage {
  readonly provider: MediaStorageProvider;
  store(
    stagedUpload: StagedMediaUpload,
    inspectedUpload: InspectedMediaUpload,
  ): Promise<StoredMediaObject>;
  open(storagePath: string): Promise<{ stream: Readable; contentLength: number }>;
  remove(storagePath: string): Promise<void>;
  discardStaged(path: string): Promise<void>;
}

export class LocalMediaStorage implements MediaStorage {
  readonly provider = MediaStorageProvider.LOCAL;
  readonly stagingDirectory: string;
  private readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = resolve(rootDirectory);
    this.stagingDirectory = resolve(this.rootDirectory, '.staging');
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.stagingDirectory, { recursive: true }),
      ...Object.values(categoryDirectories).map((directory) =>
        mkdir(resolve(this.rootDirectory, directory), { recursive: true }),
      ),
    ]);
  }

  private resolveStoragePath(storagePath: string): string {
    if (isAbsolute(storagePath)) {
      throw new MediaStoragePathError();
    }

    const absolutePath = resolve(this.rootDirectory, storagePath);
    const pathFromRoot = relative(this.rootDirectory, absolutePath);
    if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
      throw new MediaStoragePathError();
    }
    return absolutePath;
  }

  private assertStagedPath(path: string): void {
    const absolutePath = resolve(path);
    const pathFromStaging = relative(this.stagingDirectory, absolutePath);
    if (
      pathFromStaging === '..' ||
      pathFromStaging.startsWith(`..${sep}`) ||
      isAbsolute(pathFromStaging)
    ) {
      throw new MediaStoragePathError();
    }
  }

  async store(
    stagedUpload: StagedMediaUpload,
    inspectedUpload: InspectedMediaUpload,
  ): Promise<StoredMediaObject> {
    await this.initialize();
    this.assertStagedPath(stagedUpload.path);

    const storedFileName = `${randomUUID()}.${inspectedUpload.extension}`;
    const directory = categoryDirectories[inspectedUpload.category];
    const storagePath = `${directory}/${storedFileName}`;
    await rename(stagedUpload.path, this.resolveStoragePath(storagePath));

    return {
      storedFileName,
      storagePath,
      storageProvider: this.provider,
    };
  }

  async open(storagePath: string): Promise<{ stream: Readable; contentLength: number }> {
    const absolutePath = this.resolveStoragePath(storagePath);
    try {
      const fileStats = await stat(absolutePath);
      if (!fileStats.isFile()) {
        throw new MediaStorageObjectNotFoundError();
      }
      return {
        stream: createReadStream(absolutePath),
        contentLength: fileStats.size,
      };
    } catch (error: unknown) {
      if (
        error instanceof MediaStorageObjectNotFoundError ||
        (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      ) {
        throw new MediaStorageObjectNotFoundError();
      }
      throw error;
    }
  }

  async remove(storagePath: string): Promise<void> {
    await rm(this.resolveStoragePath(storagePath), { force: true });
  }

  async discardStaged(path: string): Promise<void> {
    this.assertStagedPath(path);
    await rm(path, { force: true });
  }
}
