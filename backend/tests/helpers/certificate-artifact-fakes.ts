import {
  CertificateArtifactStorageProvider,
  CertificateTemplateVersionStatus,
} from '@prisma/client';
import { Readable } from 'node:stream';
import {
  CERTIFICATE_PDF_MIME_TYPE,
  CERTIFICATE_RENDERER_CONTRACT_VERSION,
  CERTIFICATE_RENDERER_IDENTIFIER,
  CERTIFICATE_RENDERER_VERSION,
  CERTIFICATE_TEMPLATE_CODE,
  CERTIFICATE_TEMPLATE_VERSION,
  NOTO_SANS_ASSET_ID,
  NOTO_SANS_FAMILY,
  NOTO_SANS_LICENSE_IDENTIFIER,
  NOTO_SANS_PACKAGE_VERSION,
} from '../../src/modules/certificate-artifacts/certificate-artifact.constants.js';
import { calculateSha256 } from '../../src/modules/certificate-artifacts/certificate-artifact.integrity.js';
import type { CertificateArtifactRepository } from '../../src/modules/certificate-artifacts/certificate-artifact.repository.js';
import type {
  CertificateArtifactAuditContext,
  CertificateArtifactFailureAudit,
  CertificateArtifactRecord,
  CertificateArtifactStorage,
  CertificateFontManifest,
  CertificateRenderInput,
  CertificateRenderedPdf,
  CertificateRenderer,
  CertificateRenderSourceRecord,
  CreateCertificateArtifactData,
  FinalizedCertificateArtifactReceipt,
  OpenedCertificateArtifact,
  StageCertificateArtifactInput,
  StagedCertificateArtifact,
} from '../../src/modules/certificate-artifacts/certificate-artifact.types.js';

export const CERTIFICATE_ID = '019b9e24-1147-7f4b-9726-e46482877c65';
export const ARTIFACT_ID = '019b9e24-2147-7f4b-9726-e46482877c66';
export const TEMPLATE_VERSION_ID = '019b9e24-3147-7f4b-9726-e46482877c67';
export const ACTOR_ID = '019b9e24-4147-7f4b-9726-e46482877c68';
export const FONT_CHECKSUM = 'f'.repeat(64);
export const FONT_LICENSE_PROVENANCE =
  'npm:@expo-google-fonts/noto-sans@0.4.2; Noto Sans; SIL Open Font License 1.1';
const MINIMAL_PDF_BODY = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';
const MINIMAL_PDF_XREF_OFFSET = Buffer.byteLength(MINIMAL_PDF_BODY, 'ascii');
export const PDF_BYTES = Buffer.from(
  `${MINIMAL_PDF_BODY}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${String(
    MINIMAL_PDF_XREF_OFFSET,
  )}\n%%EOF\n`,
  'ascii',
);

export const certificateArtifactAuditContext: CertificateArtifactAuditContext = {
  actorUserId: ACTOR_ID,
};

export function fontManifest(
  overrides: Partial<CertificateFontManifest> = {},
): CertificateFontManifest {
  return {
    assetId: NOTO_SANS_ASSET_ID,
    family: NOTO_SANS_FAMILY,
    version: NOTO_SANS_PACKAGE_VERSION,
    licenseIdentifier: NOTO_SANS_LICENSE_IDENTIFIER,
    licenseProvenance: FONT_LICENSE_PROVENANCE,
    checksum: FONT_CHECKSUM,
    ...overrides,
  };
}

export function renderInput(
  overrides: Partial<CertificateRenderInput> = {},
): CertificateRenderInput {
  return {
    certificateId: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000042',
    recipientDisplayName: 'Yusuf Boy',
    courseTitle: 'Turk tili A1',
    completionDate: '2026-07-27',
    issueDate: '2026-07-28',
    issuedAt: '2026-07-28T10:00:00.000Z',
    organizationName: 'Turk Tili LMS',
    locale: 'uz-Latn',
    templateCode: CERTIFICATE_TEMPLATE_CODE,
    templateVersionId: TEMPLATE_VERSION_ID,
    templateVersion: CERTIFICATE_TEMPLATE_VERSION,
    rendererContractVersion: CERTIFICATE_RENDERER_CONTRACT_VERSION,
    signatoryName: 'Platform rahbari',
    signatoryTitle: 'Direktor',
    ...overrides,
  };
}

export function renderSource(
  overrides: Partial<CertificateRenderSourceRecord> = {},
): CertificateRenderSourceRecord {
  return {
    id: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000042',
    recipientDisplayName: 'Yusuf Boy',
    courseTitle: 'Turk tili A1',
    organizationName: 'Turk Tili LMS',
    locale: 'uz-Latn',
    issueDate: new Date('2026-07-28T00:00:00.000Z'),
    issuedAt: new Date('2026-07-28T10:00:00.000Z'),
    completionDate: new Date('2026-07-27T10:00:00.000Z'),
    artifactId: null,
    templateVersion: {
      id: TEMPLATE_VERSION_ID,
      version: CERTIFICATE_TEMPLATE_VERSION,
      locale: 'uz-Latn',
      status: CertificateTemplateVersionStatus.ACTIVE,
      rendererContractVersion: CERTIFICATE_RENDERER_CONTRACT_VERSION,
      organizationDisplayName: 'Turk Tili LMS',
      signatoryName: 'Platform rahbari',
      signatoryTitle: 'Direktor',
      fontAssetId: NOTO_SANS_ASSET_ID,
      fontAssetChecksum: FONT_CHECKSUM,
      fontFamily: NOTO_SANS_FAMILY,
      fontVersion: NOTO_SANS_PACKAGE_VERSION,
      fontLicenseIdentifier: NOTO_SANS_LICENSE_IDENTIFIER,
      fontLicenseProvenance: FONT_LICENSE_PROVENANCE,
      templateCode: CERTIFICATE_TEMPLATE_CODE,
    },
    ...overrides,
  };
}

export function artifactRecord(
  overrides: Partial<CertificateArtifactRecord> = {},
): CertificateArtifactRecord {
  return {
    id: ARTIFACT_ID,
    certificateId: CERTIFICATE_ID,
    storageProvider: CertificateArtifactStorageProvider.LOCAL,
    storageKey: `certificates/2026/${CERTIFICATE_ID}/019b9e24-5147-7f4b-9726-e46482877c69.pdf`,
    mimeType: CERTIFICATE_PDF_MIME_TYPE,
    sizeBytes: BigInt(PDF_BYTES.length),
    checksum: calculateSha256(PDF_BYTES),
    rendererIdentifier: CERTIFICATE_RENDERER_IDENTIFIER,
    rendererVersion: CERTIFICATE_RENDERER_VERSION,
    finalizedAt: new Date('2026-07-28T10:01:00.000Z'),
    createdAt: new Date('2026-07-28T10:01:00.000Z'),
    ...overrides,
  };
}

export class FakeCertificateRenderer implements CertificateRenderer {
  readonly identifier = CERTIFICATE_RENDERER_IDENTIFIER;
  readonly version = CERTIFICATE_RENDERER_VERSION;
  manifest = fontManifest();
  bytes = PDF_BYTES;
  error: Error | null = null;
  calls = 0;

  fontManifest(): Promise<CertificateFontManifest> {
    return Promise.resolve(this.manifest);
  }

  render(_input: CertificateRenderInput): Promise<CertificateRenderedPdf> {
    this.calls += 1;
    if (this.error) return Promise.reject(this.error);
    return Promise.resolve({
      bytes: this.bytes,
      mimeType: CERTIFICATE_PDF_MIME_TYPE,
      sizeBytes: this.bytes.length,
      rendererIdentifier: this.identifier,
      rendererVersion: this.version,
    });
  }
}

export class FakeCertificateArtifactStorage implements CertificateArtifactStorage {
  readonly provider = CertificateArtifactStorageProvider.LOCAL;
  stageError: Error | null = null;
  finalizeError: Error | null = null;
  removeError: Error | null = null;
  discardError: Error | null = null;
  staged: StagedCertificateArtifact[] = [];
  stagedBytes = new Map<string, Buffer>();
  finalized = new Map<string, Buffer>();
  removed: string[] = [];
  discarded: string[] = [];

  stage(input: StageCertificateArtifactInput): Promise<StagedCertificateArtifact> {
    if (this.stageError) return Promise.reject(this.stageError);
    const staged = {
      stageKey: '.staging/019b9e24-6147-7f4b-9726-e46482877c70.stage',
      finalStorageKey: `certificates/${String(input.issuedYear)}/${input.certificateId}/019b9e24-6147-7f4b-9726-e46482877c70.pdf`,
      expectedSizeBytes: input.bytes.length,
      expectedChecksum: input.checksum,
    };
    this.staged.push(staged);
    this.stagedBytes.set(staged.stageKey, input.bytes);
    return Promise.resolve(staged);
  }

  finalize(staged: StagedCertificateArtifact): Promise<FinalizedCertificateArtifactReceipt> {
    if (this.finalizeError) return Promise.reject(this.finalizeError);
    const bytes = this.stagedBytes.get(staged.stageKey) ?? PDF_BYTES;
    this.staged = this.staged.filter((value) => value !== staged);
    this.stagedBytes.delete(staged.stageKey);
    this.finalized.set(staged.finalStorageKey, bytes);
    return Promise.resolve({
      storageProvider: this.provider,
      storageKey: staged.finalStorageKey,
      sizeBytes: bytes.length,
      checksum: calculateSha256(bytes),
    });
  }

  discardStaged(staged: StagedCertificateArtifact): Promise<void> {
    if (this.discardError) return Promise.reject(this.discardError);
    this.discarded.push(staged.stageKey);
    this.staged = this.staged.filter((value) => value !== staged);
    this.stagedBytes.delete(staged.stageKey);
    return Promise.resolve();
  }

  removeFinalized(storageKey: string): Promise<void> {
    if (this.removeError) return Promise.reject(this.removeError);
    this.removed.push(storageKey);
    this.finalized.delete(storageKey);
    return Promise.resolve();
  }

  open(storageKey: string): Promise<OpenedCertificateArtifact> {
    const bytes = this.finalized.get(storageKey) ?? PDF_BYTES;
    return Promise.resolve({
      stream: Readable.from(bytes),
      contentLength: bytes.length,
    });
  }
}

export class FakeCertificateArtifactRepository implements CertificateArtifactRepository {
  source: CertificateRenderSourceRecord | null = renderSource();
  artifact: CertificateArtifactRecord | null = null;
  createError: Error | null = null;
  failureAuditError: Error | null = null;
  createCalls: CreateCertificateArtifactData[] = [];
  finalizedAudits: CertificateArtifactAuditContext[] = [];
  failureAudits: CertificateArtifactFailureAudit[] = [];

  findRenderSource(certificateId: string): Promise<CertificateRenderSourceRecord | null> {
    return Promise.resolve(this.source?.id === certificateId ? this.source : null);
  }

  findById(artifactId: string): Promise<CertificateArtifactRecord | null> {
    return Promise.resolve(this.artifact?.id === artifactId ? this.artifact : null);
  }

  findByCertificateId(certificateId: string): Promise<CertificateArtifactRecord | null> {
    return Promise.resolve(this.artifact?.certificateId === certificateId ? this.artifact : null);
  }

  createFinalized(
    data: CreateCertificateArtifactData,
    context: CertificateArtifactAuditContext,
  ): Promise<CertificateArtifactRecord> {
    if (this.createError) return Promise.reject(this.createError);
    this.createCalls.push(data);
    this.finalizedAudits.push(context);
    this.artifact = artifactRecord({
      certificateId: data.certificateId,
      storageProvider: data.storageProvider,
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      checksum: data.checksum,
      rendererIdentifier: data.rendererIdentifier,
      rendererVersion: data.rendererVersion,
    });
    return Promise.resolve(this.artifact);
  }

  recordFailure(
    failure: CertificateArtifactFailureAudit,
    _context: CertificateArtifactAuditContext,
  ): Promise<void> {
    if (this.failureAuditError) return Promise.reject(this.failureAuditError);
    this.failureAudits.push(failure);
    return Promise.resolve();
  }
}
