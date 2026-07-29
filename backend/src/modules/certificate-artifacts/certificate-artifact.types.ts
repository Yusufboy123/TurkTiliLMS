import type {
  CertificateArtifactStorageProvider,
  CertificateTemplateVersionStatus,
} from '@prisma/client';
import type { Readable } from 'node:stream';

export interface CertificateRenderInput {
  readonly certificateId: string;
  readonly certificateNumber: string;
  readonly recipientDisplayName: string;
  readonly courseTitle: string;
  readonly completionDate: string;
  readonly issueDate: string;
  readonly issuedAt: string;
  readonly organizationName: string;
  readonly locale: 'uz-Latn';
  readonly templateCode: string;
  readonly templateVersionId: string;
  readonly templateVersion: number;
  readonly rendererContractVersion: string;
  readonly signatoryName: string | null;
  readonly signatoryTitle: string | null;
}

export interface CertificateRenderedPdf {
  readonly bytes: Buffer;
  readonly mimeType: 'application/pdf';
  readonly sizeBytes: number;
  readonly rendererIdentifier: string;
  readonly rendererVersion: string;
}

export interface CertificateRenderer {
  readonly identifier: string;
  readonly version: string;
  render(input: CertificateRenderInput): Promise<CertificateRenderedPdf>;
  fontManifest(): Promise<CertificateFontManifest>;
}

export interface CertificateFontManifest {
  readonly assetId: string;
  readonly family: string;
  readonly version: string;
  readonly licenseIdentifier: string;
  readonly licenseProvenance: string;
  readonly checksum: string;
}

export interface CertificateFontBuffers {
  readonly regular: Buffer;
  readonly bold: Buffer;
  readonly manifest: CertificateFontManifest;
}

export interface CertificateFontSource {
  load(): Promise<CertificateFontBuffers>;
}

export interface CertificateArtifactAuditContext {
  readonly actorUserId: string;
  readonly requestCorrelationId?: string;
  readonly ipHash?: string;
  readonly userAgentSummary?: string;
}

export interface CertificateRenderSourceRecord {
  readonly id: string;
  readonly certificateNumber: string;
  readonly recipientDisplayName: string;
  readonly courseTitle: string;
  readonly organizationName: string;
  readonly locale: string;
  readonly issueDate: Date;
  readonly issuedAt: Date;
  readonly completionDate: Date;
  readonly artifactId: string | null;
  readonly templateVersion: {
    readonly id: string;
    readonly version: number;
    readonly locale: string;
    readonly status: CertificateTemplateVersionStatus;
    readonly rendererContractVersion: string | null;
    readonly organizationDisplayName: string | null;
    readonly signatoryName: string | null;
    readonly signatoryTitle: string | null;
    readonly fontAssetId: string | null;
    readonly fontAssetChecksum: string | null;
    readonly fontFamily: string | null;
    readonly fontVersion: string | null;
    readonly fontLicenseIdentifier: string | null;
    readonly fontLicenseProvenance: string | null;
    readonly templateCode: string;
  };
}

export interface CertificateArtifactRecord {
  readonly id: string;
  readonly certificateId: string;
  readonly storageProvider: CertificateArtifactStorageProvider;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: bigint;
  readonly checksum: string;
  readonly rendererIdentifier: string;
  readonly rendererVersion: string;
  readonly finalizedAt: Date;
  readonly createdAt: Date;
}

export interface CertificateArtifactMetadata {
  readonly id: string;
  readonly certificateId: string;
  readonly storageProvider: CertificateArtifactStorageProvider;
  readonly mimeType: 'application/pdf';
  readonly sizeBytes: string;
  readonly checksum: string;
  readonly rendererIdentifier: string;
  readonly rendererVersion: string;
  readonly finalizedAt: string;
  readonly createdAt: string;
}

export interface CreateCertificateArtifactData {
  readonly certificateId: string;
  readonly storageProvider: CertificateArtifactStorageProvider;
  readonly storageKey: string;
  readonly mimeType: 'application/pdf';
  readonly sizeBytes: bigint;
  readonly checksum: string;
  readonly rendererIdentifier: string;
  readonly rendererVersion: string;
}

export interface CertificateArtifactFailureAudit {
  readonly certificateId: string;
  readonly category: string;
  readonly templateVersion: number | null;
  readonly rendererIdentifier: string;
  readonly rendererVersion: string;
}

export interface StageCertificateArtifactInput {
  readonly certificateId: string;
  readonly issuedYear: number;
  readonly bytes: Buffer;
  readonly checksum: string;
}

export interface StagedCertificateArtifact {
  readonly stageKey: string;
  readonly finalStorageKey: string;
  readonly expectedSizeBytes: number;
  readonly expectedChecksum: string;
}

export interface FinalizedCertificateArtifactReceipt {
  readonly storageProvider: CertificateArtifactStorageProvider;
  readonly storageKey: string;
  readonly sizeBytes: number;
  readonly checksum: string;
}

export interface OpenedCertificateArtifact {
  readonly stream: Readable;
  readonly contentLength: number;
}

export interface ResolvedCertificateArtifact {
  readonly metadata: CertificateArtifactMetadata;
  readonly stream: Readable;
  readonly contentLength: number;
}

export interface CertificateArtifactStorage {
  readonly provider: CertificateArtifactStorageProvider;
  stage(input: StageCertificateArtifactInput): Promise<StagedCertificateArtifact>;
  finalize(staged: StagedCertificateArtifact): Promise<FinalizedCertificateArtifactReceipt>;
  discardStaged(staged: StagedCertificateArtifact): Promise<void>;
  removeFinalized(storageKey: string): Promise<void>;
  open(storageKey: string): Promise<OpenedCertificateArtifact>;
}
