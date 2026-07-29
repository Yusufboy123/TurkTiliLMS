import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, mkdir, open, realpath, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CertificateArtifactStorageProvider } from '@prisma/client';
import {
  ensureContainedDirectory,
  resolveContainedPath,
  resolveContainedRealParent,
} from '../../infrastructure/storage/safe-local-path.js';
import { CERTIFICATE_STORAGE_NAMESPACE } from './certificate-artifact.constants.js';
import { CERTIFICATE_PDF_MIME_TYPE } from './certificate-artifact.constants.js';
import {
  CertificateArtifactError,
  artifactIntegrityFailed,
  artifactNotFound,
  compensationFailed,
  finalizationFailed,
  stagingFailed,
  storageCollision,
} from './certificate-artifact.errors.js';
import {
  assertMatchingChecksum,
  calculateSha256,
  calculateStreamSha256,
  validateCertificatePdf,
} from './certificate-artifact.integrity.js';
import type {
  CertificateArtifactStorage,
  FinalizedCertificateArtifactReceipt,
  OpenedCertificateArtifact,
  StageCertificateArtifactInput,
  StagedCertificateArtifact,
} from './certificate-artifact.types.js';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const UUID_VALUE_PATTERN = new RegExp(`^${UUID_PATTERN}$`, 'u');
const FINAL_KEY_PATTERN = new RegExp(
  `^${CERTIFICATE_STORAGE_NAMESPACE}/\\d{4}/${UUID_PATTERN}/${UUID_PATTERN}\\.pdf$`,
  'u',
);
const STAGE_KEY_PATTERN = new RegExp(`^\\.staging/${UUID_PATTERN}\\.stage$`, 'u');

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function storagePathError(): CertificateArtifactError {
  return finalizationFailed();
}

async function syncDirectory(directoryPath: string): Promise<void> {
  if (process.platform === 'win32') return;
  const handle = await open(directoryPath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectoryChain(rootDirectory: string, directoryPath: string): Promise<void> {
  const realRoot = await realpath(rootDirectory);
  let currentDirectory = directoryPath;

  while (true) {
    await syncDirectory(currentDirectory);
    if (currentDirectory === realRoot) return;
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) throw finalizationFailed();
    currentDirectory = parentDirectory;
  }
}

export class LocalCertificateArtifactStorage implements CertificateArtifactStorage {
  readonly provider = CertificateArtifactStorageProvider.LOCAL;
  readonly stagingDirectory: string;
  private readonly rootDirectory: string;

  constructor(
    rootDirectory: string,
    private readonly maximumSizeBytes: number,
  ) {
    this.rootDirectory = resolve(rootDirectory);
    this.stagingDirectory = resolve(this.rootDirectory, '.staging');
  }

  async initialize(): Promise<void> {
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await ensureContainedDirectory(this.rootDirectory, this.stagingDirectory, storagePathError);
    await ensureContainedDirectory(
      this.rootDirectory,
      resolve(this.rootDirectory, CERTIFICATE_STORAGE_NAMESPACE),
      storagePathError,
    );
  }

  async stage(input: StageCertificateArtifactInput): Promise<StagedCertificateArtifact> {
    if (
      !UUID_VALUE_PATTERN.test(input.certificateId) ||
      !Number.isInteger(input.issuedYear) ||
      input.issuedYear < 2_000 ||
      input.issuedYear > 9_999
    ) {
      throw stagingFailed();
    }
    validateCertificatePdf(input.bytes, CERTIFICATE_PDF_MIME_TYPE, this.maximumSizeBytes);
    assertMatchingChecksum(calculateSha256(input.bytes), input.checksum);

    await this.initialize();
    const operationId = randomUUID();
    const stageKey = `.staging/${operationId}.stage`;
    const finalStorageKey = `${CERTIFICATE_STORAGE_NAMESPACE}/${String(
      input.issuedYear,
    )}/${input.certificateId}/${operationId}.pdf`;
    const stagePath = await resolveContainedRealParent(
      this.rootDirectory,
      this.resolveStageKey(stageKey),
      storagePathError,
    );
    let handle;

    try {
      handle = await open(stagePath, 'wx', 0o600);
      await handle.writeFile(input.bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      const fileStats = await stat(stagePath);
      if (!fileStats.isFile() || fileStats.size !== input.bytes.length) {
        throw stagingFailed();
      }

      return Object.freeze({
        stageKey,
        finalStorageKey,
        expectedSizeBytes: input.bytes.length,
        expectedChecksum: input.checksum,
      });
    } catch (error: unknown) {
      await handle?.close().catch(() => undefined);
      await rm(stagePath, { force: true }).catch(() => undefined);
      if (error instanceof CertificateArtifactError) throw error;
      throw stagingFailed();
    }
  }

  async finalize(staged: StagedCertificateArtifact): Promise<FinalizedCertificateArtifactReceipt> {
    const stagePath = await resolveContainedRealParent(
      this.rootDirectory,
      this.resolveStageKey(staged.stageKey),
      storagePathError,
    );
    const unresolvedFinalPath = this.resolveFinalKey(staged.finalStorageKey);
    await ensureContainedDirectory(
      this.rootDirectory,
      dirname(unresolvedFinalPath),
      storagePathError,
    );
    const finalPath = await resolveContainedRealParent(
      this.rootDirectory,
      unresolvedFinalPath,
      storagePathError,
    );

    try {
      await link(stagePath, finalPath);
    } catch (error: unknown) {
      if (isNodeError(error, 'EEXIST')) throw storageCollision();
      throw finalizationFailed();
    }

    try {
      const fileStats = await stat(finalPath);
      if (!fileStats.isFile() || fileStats.size !== staged.expectedSizeBytes) {
        throw artifactIntegrityFailed();
      }
      const integrity = await calculateStreamSha256(
        createReadStream(finalPath),
        this.maximumSizeBytes,
      );
      if (integrity.sizeBytes !== staged.expectedSizeBytes) {
        throw artifactIntegrityFailed();
      }
      assertMatchingChecksum(integrity.checksum, staged.expectedChecksum);
      await syncDirectoryChain(this.rootDirectory, dirname(finalPath));
      await rm(stagePath);
      await syncDirectory(dirname(stagePath));

      return Object.freeze({
        storageProvider: this.provider,
        storageKey: staged.finalStorageKey,
        sizeBytes: integrity.sizeBytes,
        checksum: integrity.checksum,
      });
    } catch (error: unknown) {
      try {
        await rm(finalPath, { force: true });
      } catch {
        throw compensationFailed();
      }
      if (error instanceof CertificateArtifactError) throw error;
      throw finalizationFailed();
    }
  }

  async discardStaged(staged: StagedCertificateArtifact): Promise<void> {
    const stagePath = await resolveContainedRealParent(
      this.rootDirectory,
      this.resolveStageKey(staged.stageKey),
      storagePathError,
    );
    await rm(stagePath, { force: true });
  }

  async removeFinalized(storageKey: string): Promise<void> {
    const finalPath = await resolveContainedRealParent(
      this.rootDirectory,
      this.resolveFinalKey(storageKey),
      storagePathError,
    );
    await rm(finalPath, { force: true });
  }

  async open(storageKey: string): Promise<OpenedCertificateArtifact> {
    try {
      const finalPath = await resolveContainedRealParent(
        this.rootDirectory,
        this.resolveFinalKey(storageKey),
        storagePathError,
      );
      const fileStats = await stat(finalPath);
      if (!fileStats.isFile()) throw artifactNotFound();
      return {
        stream: createReadStream(finalPath),
        contentLength: fileStats.size,
      };
    } catch (error: unknown) {
      if (error instanceof CertificateArtifactError) throw error;
      if (isNodeError(error, 'ENOENT')) throw artifactNotFound();
      throw finalizationFailed();
    }
  }

  private resolveStageKey(stageKey: string): string {
    if (!STAGE_KEY_PATTERN.test(stageKey)) throw storagePathError();
    return resolveContainedPath(this.rootDirectory, stageKey, storagePathError);
  }

  private resolveFinalKey(storageKey: string): string {
    if (!FINAL_KEY_PATTERN.test(storageKey)) throw storagePathError();
    return resolveContainedPath(this.rootDirectory, storageKey, storagePathError);
  }
}
