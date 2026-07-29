import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CertificateArtifactAuditContext,
  CertificateArtifactFailureAudit,
  CertificateArtifactRecord,
  CertificateRenderSourceRecord,
  CreateCertificateArtifactData,
} from './certificate-artifact.types.js';

const certificateRenderSourceSelect = {
  id: true,
  certificateNumber: true,
  recipientDisplayName: true,
  courseTitle: true,
  organizationName: true,
  locale: true,
  issueDate: true,
  issuedAt: true,
  artifact: { select: { id: true } },
  eligibilityEvaluation: { select: { completedAt: true } },
  templateVersion: {
    select: {
      id: true,
      version: true,
      locale: true,
      status: true,
      rendererContractVersion: true,
      organizationDisplayName: true,
      signatoryName: true,
      signatoryTitle: true,
      fontAssetId: true,
      fontAssetChecksum: true,
      fontFamily: true,
      fontVersion: true,
      fontLicenseIdentifier: true,
      fontLicenseProvenance: true,
      template: { select: { code: true } },
    },
  },
} satisfies Prisma.CertificateSelect;

const certificateArtifactSelect = {
  id: true,
  certificateId: true,
  storageProvider: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  checksum: true,
  rendererIdentifier: true,
  rendererVersion: true,
  finalizedAt: true,
  createdAt: true,
} satisfies Prisma.CertificateArtifactSelect;

type CertificateRenderSourcePayload = Prisma.CertificateGetPayload<{
  select: typeof certificateRenderSourceSelect;
}>;
type CertificateArtifactPayload = Prisma.CertificateArtifactGetPayload<{
  select: typeof certificateArtifactSelect;
}>;

function auditFields(context: CertificateArtifactAuditContext) {
  return {
    actorUserId: context.actorUserId,
    ...(context.requestCorrelationId ? { requestCorrelationId: context.requestCorrelationId } : {}),
    ...(context.ipHash ? { ipHash: context.ipHash } : {}),
    ...(context.userAgentSummary ? { userAgentSummary: context.userAgentSummary } : {}),
  };
}

function mapRenderSource(source: CertificateRenderSourcePayload): CertificateRenderSourceRecord {
  return {
    id: source.id,
    certificateNumber: source.certificateNumber,
    recipientDisplayName: source.recipientDisplayName,
    courseTitle: source.courseTitle,
    organizationName: source.organizationName,
    locale: source.locale,
    issueDate: source.issueDate,
    issuedAt: source.issuedAt,
    completionDate: source.eligibilityEvaluation.completedAt,
    artifactId: source.artifact?.id ?? null,
    templateVersion: {
      id: source.templateVersion.id,
      version: source.templateVersion.version,
      locale: source.templateVersion.locale,
      status: source.templateVersion.status,
      rendererContractVersion: source.templateVersion.rendererContractVersion,
      organizationDisplayName: source.templateVersion.organizationDisplayName,
      signatoryName: source.templateVersion.signatoryName,
      signatoryTitle: source.templateVersion.signatoryTitle,
      fontAssetId: source.templateVersion.fontAssetId,
      fontAssetChecksum: source.templateVersion.fontAssetChecksum,
      fontFamily: source.templateVersion.fontFamily,
      fontVersion: source.templateVersion.fontVersion,
      fontLicenseIdentifier: source.templateVersion.fontLicenseIdentifier,
      fontLicenseProvenance: source.templateVersion.fontLicenseProvenance,
      templateCode: source.templateVersion.template.code,
    },
  };
}

function mapArtifact(artifact: CertificateArtifactPayload): CertificateArtifactRecord {
  return artifact;
}

function prismaTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String).join(',');
  return typeof target === 'string' ? target : '';
}

function prismaForeignKeyField(error: Prisma.PrismaClientKnownRequestError): string {
  const fieldName = error.meta?.field_name;
  return typeof fieldName === 'string' ? fieldName : '';
}

export class CertificateArtifactRepositoryDuplicateError extends Error {
  constructor(readonly target: 'certificate' | 'storage') {
    super('Certificate artifact uniqueness conflict.');
    this.name = 'CertificateArtifactRepositoryDuplicateError';
  }
}

export class CertificateArtifactRepositoryCertificateMissingError extends Error {
  constructor() {
    super('Certificate persistence target does not exist.');
    this.name = 'CertificateArtifactRepositoryCertificateMissingError';
  }
}

export interface CertificateArtifactRepository {
  findRenderSource(certificateId: string): Promise<CertificateRenderSourceRecord | null>;
  findById(artifactId: string): Promise<CertificateArtifactRecord | null>;
  findByCertificateId(certificateId: string): Promise<CertificateArtifactRecord | null>;
  createFinalized(
    data: CreateCertificateArtifactData,
    context: CertificateArtifactAuditContext,
  ): Promise<CertificateArtifactRecord>;
  recordFailure(
    failure: CertificateArtifactFailureAudit,
    context: CertificateArtifactAuditContext,
  ): Promise<void>;
}

export class PrismaCertificateArtifactRepository implements CertificateArtifactRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findRenderSource(certificateId: string): Promise<CertificateRenderSourceRecord | null> {
    const source = await this.client.certificate.findUnique({
      where: { id: certificateId },
      select: certificateRenderSourceSelect,
    });
    return source ? mapRenderSource(source) : null;
  }

  async findById(artifactId: string): Promise<CertificateArtifactRecord | null> {
    const artifact = await this.client.certificateArtifact.findUnique({
      where: { id: artifactId },
      select: certificateArtifactSelect,
    });
    return artifact ? mapArtifact(artifact) : null;
  }

  async findByCertificateId(certificateId: string): Promise<CertificateArtifactRecord | null> {
    const artifact = await this.client.certificateArtifact.findUnique({
      where: { certificateId },
      select: certificateArtifactSelect,
    });
    return artifact ? mapArtifact(artifact) : null;
  }

  async createFinalized(
    data: CreateCertificateArtifactData,
    context: CertificateArtifactAuditContext,
  ): Promise<CertificateArtifactRecord> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const timestamps = await transaction.$queryRaw<{ currentTime: Date }[]>`
          SELECT clock_timestamp() AS "currentTime"
        `;
        const currentTime = timestamps[0]?.currentTime;
        if (!currentTime) throw new Error('Database timestamp was unavailable.');

        const artifact = await transaction.certificateArtifact.create({
          data: {
            ...data,
            finalizedAt: currentTime,
            createdAt: currentTime,
          },
          select: certificateArtifactSelect,
        });
        await transaction.auditLog.create({
          data: {
            ...auditFields(context),
            action: 'certificate.artifact_finalized',
            subjectType: 'certificate_artifact',
            subjectId: artifact.id,
            metadata: {
              certificateId: artifact.certificateId,
              storageProvider: artifact.storageProvider,
              mimeType: artifact.mimeType,
              sizeBytes: artifact.sizeBytes.toString(),
              checksumPrefix: artifact.checksum.slice(0, 12),
              rendererIdentifier: artifact.rendererIdentifier,
              rendererVersion: artifact.rendererVersion,
            },
          },
        });
        return mapArtifact(artifact);
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = prismaTarget(error);
        if (
          target.includes('certificateId') ||
          target.includes('certificate_id') ||
          target.includes('certificate_artifacts_certificate_id_key')
        ) {
          throw new CertificateArtifactRepositoryDuplicateError('certificate');
        }
        if (
          target.includes('storageKey') ||
          target.includes('storage_key') ||
          target.includes('certificate_artifacts_storage_key_key')
        ) {
          throw new CertificateArtifactRepositoryDuplicateError('storage');
        }
        if (!target) {
          const existingCertificateArtifact = await this.client.certificateArtifact.findUnique({
            where: { certificateId: data.certificateId },
            select: { id: true },
          });
          if (existingCertificateArtifact) {
            throw new CertificateArtifactRepositoryDuplicateError('certificate');
          }
          const existingStorageArtifact = await this.client.certificateArtifact.findUnique({
            where: { storageKey: data.storageKey },
            select: { id: true },
          });
          if (existingStorageArtifact) {
            throw new CertificateArtifactRepositoryDuplicateError('storage');
          }
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        const fieldName = prismaForeignKeyField(error);
        if (fieldName.includes('certificate_id')) {
          throw new CertificateArtifactRepositoryCertificateMissingError();
        }
        if (!fieldName || fieldName.includes('not available')) {
          const certificate = await this.client.certificate.findUnique({
            where: { id: data.certificateId },
            select: { id: true },
          });
          if (!certificate) {
            throw new CertificateArtifactRepositoryCertificateMissingError();
          }
        }
      }
      throw error;
    }
  }

  async recordFailure(
    failure: CertificateArtifactFailureAudit,
    context: CertificateArtifactAuditContext,
  ): Promise<void> {
    await this.client.auditLog.create({
      data: {
        ...auditFields(context),
        action: 'certificate.artifact_finalization_failed',
        subjectType: 'certificate',
        subjectId: failure.certificateId,
        metadata: {
          category: failure.category,
          templateVersion: failure.templateVersion,
          rendererIdentifier: failure.rendererIdentifier,
          rendererVersion: failure.rendererVersion,
        },
      },
    });
  }
}
