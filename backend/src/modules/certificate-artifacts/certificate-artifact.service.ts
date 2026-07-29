import { CertificateTemplateVersionStatus } from '@prisma/client';
import { Readable } from 'node:stream';
import {
  CERTIFICATE_PDF_MIME_TYPE,
  CERTIFICATE_RENDERER_CONTRACT_VERSION,
  CERTIFICATE_TEMPLATE_CODE,
  CERTIFICATE_TEMPLATE_VERSION,
} from './certificate-artifact.constants.js';
import {
  CertificateArtifactError,
  artifactAlreadyExists,
  artifactIntegrityFailed,
  artifactNotFound,
  certificateNotFound,
  compensationFailed,
  fontAssetMismatch,
  persistenceFailed,
  storageCollision,
  unsupportedTemplate,
} from './certificate-artifact.errors.js';
import {
  assertMatchingChecksum,
  calculateSha256,
  calculateStreamSha256,
  collectVerifiedStreamBytes,
  validateCertificatePdf,
} from './certificate-artifact.integrity.js';
import {
  CertificateArtifactRepositoryCertificateMissingError,
  CertificateArtifactRepositoryDuplicateError,
  type CertificateArtifactRepository,
} from './certificate-artifact.repository.js';
import { normalizeCertificateRenderInput } from './certificate-render-input.js';
import type {
  CertificateArtifactAuditContext,
  CertificateFontManifest,
  CertificateArtifactMetadata,
  CertificateArtifactRecord,
  CertificateArtifactStorage,
  CertificateRenderSourceRecord,
  CertificateRenderInput,
  CertificateRenderer,
  ResolvedCertificateArtifact,
  StagedCertificateArtifact,
} from './certificate-artifact.types.js';

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toMetadata(record: CertificateArtifactRecord): CertificateArtifactMetadata {
  if (record.mimeType !== CERTIFICATE_PDF_MIME_TYPE) throw artifactIntegrityFailed();
  return Object.freeze({
    id: record.id,
    certificateId: record.certificateId,
    storageProvider: record.storageProvider,
    mimeType: CERTIFICATE_PDF_MIME_TYPE,
    sizeBytes: record.sizeBytes.toString(),
    checksum: record.checksum,
    rendererIdentifier: record.rendererIdentifier,
    rendererVersion: record.rendererVersion,
    finalizedAt: record.finalizedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  });
}

function mapRepositoryError(error: unknown): CertificateArtifactError {
  if (error instanceof CertificateArtifactError) return error;
  if (error instanceof CertificateArtifactRepositoryDuplicateError) {
    return error.target === 'certificate' ? artifactAlreadyExists() : storageCollision();
  }
  if (error instanceof CertificateArtifactRepositoryCertificateMissingError) {
    return certificateNotFound();
  }
  return persistenceFailed();
}

export interface FinalizeCertificateArtifactInput {
  readonly certificateId: string;
  readonly renderInput: unknown;
  readonly audit: CertificateArtifactAuditContext;
}

export interface CertificateArtifactUseCases {
  finalizeCertificateArtifact(
    input: FinalizeCertificateArtifactInput,
  ): Promise<CertificateArtifactMetadata>;
  getFinalizedCertificateArtifactMetadata(
    certificateId: string,
  ): Promise<CertificateArtifactMetadata>;
  resolveFinalizedCertificateArtifact(artifactId: string): Promise<ResolvedCertificateArtifact>;
  verifyStoredArtifactIntegrity(artifactId: string): Promise<boolean>;
}

export class CertificateArtifactService implements CertificateArtifactUseCases {
  constructor(
    private readonly repository: CertificateArtifactRepository,
    private readonly renderer: CertificateRenderer,
    private readonly storage: CertificateArtifactStorage,
    private readonly maximumSizeBytes: number,
  ) {}

  async finalizeCertificateArtifact(
    request: FinalizeCertificateArtifactInput,
  ): Promise<CertificateArtifactMetadata> {
    let normalizedInput: CertificateRenderInput | undefined;
    let staged: StagedCertificateArtifact | undefined;
    let finalizedStorageKey: string | undefined;

    try {
      normalizedInput = normalizeCertificateRenderInput(request.renderInput);
      if (normalizedInput.certificateId !== request.certificateId) {
        throw certificateNotFound();
      }

      const source = await this.repository.findRenderSource(request.certificateId);
      if (!source) throw certificateNotFound();
      if (source.artifactId) throw artifactAlreadyExists();

      const fontManifest = await this.renderer.fontManifest();
      this.assertRenderSource(normalizedInput, source, fontManifest);

      const rendered = await this.renderer.render(normalizedInput);
      validateCertificatePdf(rendered.bytes, rendered.mimeType, this.maximumSizeBytes);
      if (rendered.sizeBytes !== rendered.bytes.length) throw artifactIntegrityFailed();
      const checksum = calculateSha256(rendered.bytes);

      staged = await this.storage.stage({
        certificateId: request.certificateId,
        issuedYear: Number(normalizedInput.issueDate.slice(0, 4)),
        bytes: rendered.bytes,
        checksum,
      });
      const receipt = await this.storage.finalize(staged);
      staged = undefined;
      finalizedStorageKey = receipt.storageKey;

      if (
        receipt.storageProvider !== this.storage.provider ||
        receipt.sizeBytes !== rendered.bytes.length
      ) {
        throw artifactIntegrityFailed();
      }
      assertMatchingChecksum(receipt.checksum, checksum);

      const artifact = await this.repository.createFinalized(
        {
          certificateId: request.certificateId,
          storageProvider: receipt.storageProvider,
          storageKey: receipt.storageKey,
          mimeType: CERTIFICATE_PDF_MIME_TYPE,
          sizeBytes: BigInt(receipt.sizeBytes),
          checksum: receipt.checksum,
          rendererIdentifier: rendered.rendererIdentifier,
          rendererVersion: rendered.rendererVersion,
        },
        request.audit,
      );
      finalizedStorageKey = undefined;
      return toMetadata(artifact);
    } catch (error: unknown) {
      let failure = mapRepositoryError(error);
      const cleanupFailed = await this.compensate(staged, finalizedStorageKey);
      if (cleanupFailed) failure = compensationFailed();

      try {
        await this.repository.recordFailure(
          {
            certificateId: request.certificateId,
            category: failure.category,
            templateVersion: normalizedInput?.templateVersion ?? null,
            rendererIdentifier: this.renderer.identifier,
            rendererVersion: this.renderer.version,
          },
          request.audit,
        );
      } catch {
        if (!cleanupFailed) failure = persistenceFailed();
      }
      throw failure;
    }
  }

  async getFinalizedCertificateArtifactMetadata(
    certificateId: string,
  ): Promise<CertificateArtifactMetadata> {
    const artifact = await this.repository.findByCertificateId(certificateId);
    if (!artifact) throw artifactNotFound();
    return toMetadata(artifact);
  }

  async resolveFinalizedCertificateArtifact(
    artifactId: string,
  ): Promise<ResolvedCertificateArtifact> {
    const artifact = await this.repository.findById(artifactId);
    if (!artifact || artifact.storageProvider !== this.storage.provider) {
      throw artifactNotFound();
    }
    const opened = await this.storage.open(artifact.storageKey);
    const verified = await collectVerifiedStreamBytes(opened.stream, this.maximumSizeBytes);
    if (
      verified.sizeBytes !== opened.contentLength ||
      BigInt(verified.sizeBytes) !== artifact.sizeBytes
    ) {
      throw artifactIntegrityFailed();
    }
    assertMatchingChecksum(verified.checksum, artifact.checksum);
    validateCertificatePdf(verified.bytes, artifact.mimeType, this.maximumSizeBytes);
    return Object.freeze({
      metadata: toMetadata(artifact),
      stream: Readable.from([verified.bytes]),
      contentLength: verified.sizeBytes,
    });
  }

  async verifyStoredArtifactIntegrity(artifactId: string): Promise<boolean> {
    const artifact = await this.repository.findById(artifactId);
    if (!artifact || artifact.storageProvider !== this.storage.provider) {
      throw artifactNotFound();
    }
    const opened = await this.storage.open(artifact.storageKey);
    const integrity = await calculateStreamSha256(opened.stream, this.maximumSizeBytes);
    if (
      integrity.sizeBytes !== opened.contentLength ||
      BigInt(integrity.sizeBytes) !== artifact.sizeBytes
    ) {
      throw artifactIntegrityFailed();
    }
    assertMatchingChecksum(integrity.checksum, artifact.checksum);
    return true;
  }

  private async compensate(
    staged: StagedCertificateArtifact | undefined,
    finalizedStorageKey: string | undefined,
  ): Promise<boolean> {
    let cleanupFailed = false;
    if (staged) {
      try {
        await this.storage.discardStaged(staged);
      } catch {
        cleanupFailed = true;
      }
    }
    if (finalizedStorageKey) {
      try {
        await this.storage.removeFinalized(finalizedStorageKey);
      } catch {
        cleanupFailed = true;
      }
    }
    return cleanupFailed;
  }

  private assertRenderSource(
    input: CertificateRenderInput,
    source: CertificateRenderSourceRecord,
    fontManifest: CertificateFontManifest,
  ): void {
    if (
      source.templateVersion.status === CertificateTemplateVersionStatus.DRAFT ||
      input.certificateId !== source.id ||
      input.certificateNumber !== source.certificateNumber ||
      input.recipientDisplayName !== source.recipientDisplayName ||
      input.courseTitle !== source.courseTitle ||
      input.organizationName !== source.organizationName ||
      input.completionDate !== dateOnly(source.completionDate) ||
      input.issueDate !== dateOnly(source.issueDate) ||
      input.issuedAt !== source.issuedAt.toISOString() ||
      input.locale !== source.locale ||
      input.locale !== source.templateVersion.locale ||
      input.templateCode !== CERTIFICATE_TEMPLATE_CODE ||
      input.templateCode !== source.templateVersion.templateCode ||
      input.templateVersionId !== source.templateVersion.id ||
      input.templateVersion !== CERTIFICATE_TEMPLATE_VERSION ||
      input.templateVersion !== source.templateVersion.version ||
      input.rendererContractVersion !== CERTIFICATE_RENDERER_CONTRACT_VERSION ||
      input.rendererContractVersion !== source.templateVersion.rendererContractVersion ||
      input.signatoryName !== source.templateVersion.signatoryName ||
      input.signatoryTitle !== source.templateVersion.signatoryTitle ||
      source.templateVersion.organizationDisplayName !== source.organizationName
    ) {
      throw unsupportedTemplate();
    }

    if (
      source.templateVersion.fontAssetId !== fontManifest.assetId ||
      source.templateVersion.fontAssetChecksum !== fontManifest.checksum ||
      source.templateVersion.fontFamily !== fontManifest.family ||
      source.templateVersion.fontVersion !== fontManifest.version ||
      source.templateVersion.fontLicenseIdentifier !== fontManifest.licenseIdentifier ||
      source.templateVersion.fontLicenseProvenance !== fontManifest.licenseProvenance
    ) {
      throw fontAssetMismatch();
    }
  }
}
