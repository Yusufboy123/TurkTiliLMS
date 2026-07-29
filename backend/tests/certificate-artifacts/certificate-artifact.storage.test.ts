import { access, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCertificateArtifactStorageRoot } from '../../src/modules/certificate-artifacts/certificate-artifact.storage-root.js';
import { LocalCertificateArtifactStorage } from '../../src/modules/certificate-artifacts/certificate-artifact.storage.js';
import { calculateSha256 } from '../../src/modules/certificate-artifacts/certificate-artifact.integrity.js';
import { CERTIFICATE_ID, PDF_BYTES } from '../helpers/certificate-artifact-fakes.js';

describe('LocalCertificateArtifactStorage', () => {
  let rootDirectory: string;
  let outsideDirectory: string;
  let storage: LocalCertificateArtifactStorage;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), 'turk-tili-certificate-storage-'));
    outsideDirectory = await mkdtemp(join(tmpdir(), 'turk-tili-certificate-outside-'));
    storage = new LocalCertificateArtifactStorage(rootDirectory, 10_485_760);
  });

  afterEach(async () => {
    await Promise.all([
      rm(rootDirectory, { recursive: true, force: true }),
      rm(outsideDirectory, { recursive: true, force: true }),
    ]);
  });

  async function stage() {
    return storage.stage({
      certificateId: CERTIFICATE_ID,
      issuedYear: 2026,
      bytes: PDF_BYTES,
      checksum: calculateSha256(PDF_BYTES),
    });
  }

  it('stages privately and atomically finalizes into the certificate namespace', async () => {
    const staged = await stage();
    expect(staged.stageKey).toMatch(/^\.staging\/[0-9a-f-]+\.stage$/u);
    expect(staged.finalStorageKey).toMatch(
      new RegExp(`^certificates/2026/${CERTIFICATE_ID}/[0-9a-f-]+\\.pdf$`, 'u'),
    );

    const receipt = await storage.finalize(staged);
    expect(receipt).toMatchObject({
      storageKey: staged.finalStorageKey,
      sizeBytes: PDF_BYTES.length,
      checksum: calculateSha256(PDF_BYTES),
    });
    await expect(access(join(rootDirectory, ...staged.stageKey.split('/')))).rejects.toThrow();
    expect(await readFile(join(rootDirectory, ...receipt.storageKey.split('/')))).toEqual(
      PDF_BYTES,
    );
  });

  it('opens finalized bytes without returning a filesystem path or public URL', async () => {
    const receipt = await storage.finalize(await stage());
    const opened = await storage.open(receipt.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(opened).not.toHaveProperty('path');
    expect(opened).not.toHaveProperty('url');
    expect(opened.contentLength).toBe(PDF_BYTES.length);
    expect(Buffer.concat(chunks)).toEqual(PDF_BYTES);
  });

  it('prevents overwrite collisions and leaves the second staged object removable', async () => {
    const first = await stage();
    const firstReceipt = await storage.finalize(first);
    const second = await stage();
    const colliding = { ...second, finalStorageKey: firstReceipt.storageKey };

    await expect(storage.finalize(colliding)).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_STORAGE_COLLISION',
    });
    await storage.discardStaged(second);
    expect(await readFile(join(rootDirectory, ...firstReceipt.storageKey.split('/')))).toEqual(
      PDF_BYTES,
    );
  });

  it('rejects path traversal and non-certificate namespaces without leaking paths', async () => {
    await expect(storage.open('../outside.pdf')).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_STORAGE_FAILED',
      message: expect.not.stringContaining(rootDirectory),
    });
    await expect(storage.open('images/file.pdf')).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_STORAGE_FAILED',
    });
  });

  it('rejects caller-controlled invalid identity before writing a staged object', async () => {
    await expect(
      storage.stage({
        certificateId: '../outside',
        issuedYear: 2026,
        bytes: PDF_BYTES,
        checksum: calculateSha256(PDF_BYTES),
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ARTIFACT_STAGING_FAILED' });
  });

  it('rejects a symlinked final-directory escape before creating outside content', async () => {
    await storage.initialize();
    const yearDirectory = join(rootDirectory, 'certificates', '2026');
    await symlink(
      outsideDirectory,
      yearDirectory,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const staged = await stage();

    await expect(storage.finalize(staged)).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_STORAGE_FAILED',
    });
    await expect(access(join(outsideDirectory, CERTIFICATE_ID))).rejects.toThrow();
    await storage.discardStaged(staged);
  });

  it('removes a finalized object explicitly and reports missing objects safely', async () => {
    const receipt = await storage.finalize(await stage());
    await storage.removeFinalized(receipt.storageKey);

    await expect(storage.open(receipt.storageKey)).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_NOT_FOUND',
      message: expect.not.stringContaining(receipt.storageKey),
    });
  });

  it('rejects checksum mismatch before staging any bytes', async () => {
    await expect(
      storage.stage({
        certificateId: CERTIFICATE_ID,
        issuedYear: 2026,
        bytes: PDF_BYTES,
        checksum: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ARTIFACT_UNAVAILABLE' });
  });

  it('requires a dedicated private root outside project and media storage roots', () => {
    const projectRoot = join(rootDirectory, 'project');

    expect(
      resolveCertificateArtifactStorageRoot(
        projectRoot,
        'private-certificate-artifacts',
        'uploads',
      ),
    ).toBe(join(projectRoot, 'private-certificate-artifacts'));
    expect(() => resolveCertificateArtifactStorageRoot(projectRoot, '.', 'uploads')).toThrow(
      /dedicated private directory/u,
    );
    expect(() =>
      resolveCertificateArtifactStorageRoot(projectRoot, 'uploads/certificates', 'uploads'),
    ).toThrow(/dedicated private directory/u);
    expect(() =>
      resolveCertificateArtifactStorageRoot(projectRoot, 'uploads/..private', 'uploads'),
    ).toThrow(/dedicated private directory/u);
    expect(() =>
      resolveCertificateArtifactStorageRoot(projectRoot, 'private', 'private/media'),
    ).toThrow(/dedicated private directory/u);
    expect(() =>
      resolveCertificateArtifactStorageRoot(projectRoot, '../private', 'uploads'),
    ).toThrow(/dedicated private directory/u);
  });
});
