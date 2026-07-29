import {
  artifactAlreadyExists,
  finalizationFailed,
  renderFailed,
  stagingFailed,
} from '../../src/modules/certificate-artifacts/certificate-artifact.errors.js';
import { calculateSha256 } from '../../src/modules/certificate-artifacts/certificate-artifact.integrity.js';
import { CertificateArtifactService } from '../../src/modules/certificate-artifacts/certificate-artifact.service.js';
import {
  ARTIFACT_ID,
  CERTIFICATE_ID,
  PDF_BYTES,
  FakeCertificateArtifactRepository,
  FakeCertificateArtifactStorage,
  FakeCertificateRenderer,
  artifactRecord,
  certificateArtifactAuditContext,
  fontManifest,
  renderInput,
  renderSource,
} from '../helpers/certificate-artifact-fakes.js';

function setup() {
  const repository = new FakeCertificateArtifactRepository();
  const renderer = new FakeCertificateRenderer();
  const storage = new FakeCertificateArtifactStorage();
  const service = new CertificateArtifactService(repository, renderer, storage, 10_485_760);
  return { repository, renderer, storage, service };
}

describe('CertificateArtifactService', () => {
  it('finalizes storage before persisting immutable metadata and returns no path or URL', async () => {
    const { repository, renderer, storage, service } = setup();
    const result = await service.finalizeCertificateArtifact({
      certificateId: CERTIFICATE_ID,
      renderInput: renderInput(),
      audit: certificateArtifactAuditContext,
    });

    expect(renderer.calls).toBe(1);
    expect(storage.staged).toHaveLength(0);
    expect(storage.finalized.size).toBe(1);
    expect(repository.createCalls).toHaveLength(1);
    expect(repository.createCalls[0]).toMatchObject({
      certificateId: CERTIFICATE_ID,
      mimeType: 'application/pdf',
      sizeBytes: BigInt(PDF_BYTES.length),
      checksum: calculateSha256(PDF_BYTES),
    });
    expect(repository.finalizedAudits).toHaveLength(1);
    expect(repository.failureAudits).toHaveLength(0);
    expect(result).not.toHaveProperty('storageKey');
    expect(result).not.toHaveProperty('path');
    expect(result).not.toHaveProperty('url');
  });

  it('requires an existing certificate and creates no transient artifact record', async () => {
    const { repository, renderer, storage, service } = setup();
    repository.source = null;

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_NOT_FOUND' });

    expect(renderer.calls).toBe(0);
    expect(storage.staged).toHaveLength(0);
    expect(storage.finalized.size).toBe(0);
    expect(repository.createCalls).toHaveLength(0);
    expect(repository.failureAudits).toEqual([
      expect.objectContaining({ category: 'CERTIFICATE_NOT_FOUND' }),
    ]);
  });

  it('rejects duplicate artifacts before rendering', async () => {
    const { repository, renderer, service } = setup();
    repository.source = renderSource({ artifactId: ARTIFACT_ID });

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toEqual(artifactAlreadyExists());
    expect(renderer.calls).toBe(0);
    expect(repository.createCalls).toHaveLength(0);
  });

  it('rejects unapproved font provenance before rendering', async () => {
    const { repository, renderer, service } = setup();
    renderer.manifest = fontManifest({ checksum: 'a'.repeat(64) });

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_FONT_ASSET_MISMATCH' });
    expect(renderer.calls).toBe(0);
    expect(repository.createCalls).toHaveLength(0);
  });

  it('creates no storage or artifact metadata after renderer failure', async () => {
    const { repository, renderer, storage, service } = setup();
    renderer.error = renderFailed();

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toEqual(renderFailed());
    expect(storage.staged).toHaveLength(0);
    expect(storage.finalized.size).toBe(0);
    expect(repository.createCalls).toHaveLength(0);
    expect(repository.failureAudits).toEqual([
      expect.objectContaining({ category: 'RENDER_FAILED' }),
    ]);
  });

  it('rejects invalid PDF output before staging', async () => {
    const { repository, renderer, storage, service } = setup();
    renderer.bytes = Buffer.from('not a PDF');

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_PDF_OUTPUT_INVALID' });
    expect(storage.staged).toHaveLength(0);
    expect(repository.createCalls).toHaveLength(0);
  });

  it('creates no artifact metadata after staging failure', async () => {
    const { repository, storage, service } = setup();
    storage.stageError = stagingFailed();

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toEqual(stagingFailed());
    expect(repository.createCalls).toHaveLength(0);
  });

  it('discards staged bytes after finalization failure', async () => {
    const { repository, storage, service } = setup();
    storage.finalizeError = finalizationFailed();

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toEqual(finalizationFailed());
    expect(storage.discarded).toHaveLength(1);
    expect(storage.staged).toHaveLength(0);
    expect(storage.finalized.size).toBe(0);
    expect(repository.createCalls).toHaveLength(0);
  });

  it('compensates finalized storage when database persistence fails', async () => {
    const { repository, storage, service } = setup();
    repository.createError = new Error('database unavailable at private host');

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_PERSISTENCE_FAILED',
      message: expect.not.stringContaining('private host'),
    });
    expect(storage.removed).toHaveLength(1);
    expect(storage.finalized.size).toBe(0);
    expect(repository.failureAudits).toHaveLength(1);
  });

  it('surfaces compensation failure safely and audits it once', async () => {
    const { repository, storage, service } = setup();
    repository.createError = new Error('database unavailable');
    storage.removeError = new Error('C:\\private\\certificate.pdf');

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_COMPENSATION_FAILED',
      message: expect.not.stringContaining('C:\\private'),
    });
    expect(repository.failureAudits).toEqual([
      expect.objectContaining({ category: 'COMPENSATION_FAILED' }),
    ]);
  });

  it('preserves compensation failure when recording its failure audit also fails', async () => {
    const { repository, storage, service } = setup();
    repository.createError = new Error('database unavailable');
    repository.failureAuditError = new Error('audit unavailable');
    storage.removeError = new Error('private storage unavailable');

    await expect(
      service.finalizeCertificateArtifact({
        certificateId: CERTIFICATE_ID,
        renderInput: renderInput(),
        audit: certificateArtifactAuditContext,
      }),
    ).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_COMPENSATION_FAILED',
    });
  });

  it('resolves and verifies finalized artifacts without leaking storage keys', async () => {
    const { repository, storage, service } = setup();
    const artifact = artifactRecord();
    repository.artifact = artifact;
    storage.finalized.set(artifact.storageKey, PDF_BYTES);

    const resolved = await service.resolveFinalizedCertificateArtifact(ARTIFACT_ID);
    expect(resolved.metadata).not.toHaveProperty('storageKey');
    expect(resolved).not.toHaveProperty('path');
    expect(resolved.contentLength).toBe(PDF_BYTES.length);
    resolved.stream.destroy();
    await expect(service.verifyStoredArtifactIntegrity(ARTIFACT_ID)).resolves.toBe(true);
  });

  it('rejects missing and checksum-invalid stored artifacts', async () => {
    const { repository, storage, service } = setup();
    await expect(
      service.getFinalizedCertificateArtifactMetadata(CERTIFICATE_ID),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ARTIFACT_NOT_FOUND' });

    const artifact = artifactRecord();
    repository.artifact = artifact;
    storage.finalized.set(artifact.storageKey, Buffer.from('%PDF-1.7\nchanged\n%%EOF\n'));
    await expect(service.verifyStoredArtifactIntegrity(ARTIFACT_ID)).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_UNAVAILABLE',
    });
    await expect(service.resolveFinalizedCertificateArtifact(ARTIFACT_ID)).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_UNAVAILABLE',
    });
  });
});
