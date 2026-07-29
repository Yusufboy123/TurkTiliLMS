import {
  CertificateArtifactStorageProvider,
  CertificateTemplateVersionStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { vi } from 'vitest';
import {
  CertificateArtifactRepositoryCertificateMissingError,
  CertificateArtifactRepositoryDuplicateError,
  PrismaCertificateArtifactRepository,
} from '../../src/modules/certificate-artifacts/certificate-artifact.repository.js';
import {
  ACTOR_ID,
  ARTIFACT_ID,
  CERTIFICATE_ID,
  TEMPLATE_VERSION_ID,
  artifactRecord,
  certificateArtifactAuditContext,
} from '../helpers/certificate-artifact-fakes.js';

function databaseRenderSource() {
  return {
    id: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000042',
    recipientDisplayName: 'Yusuf Boy',
    courseTitle: 'Turk tili A1',
    organizationName: 'Turk Tili LMS',
    locale: 'uz-Latn',
    issueDate: new Date('2026-07-28T00:00:00.000Z'),
    issuedAt: new Date('2026-07-28T10:00:00.000Z'),
    artifact: null,
    eligibilityEvaluation: {
      completedAt: new Date('2026-07-27T10:00:00.000Z'),
    },
    templateVersion: {
      id: TEMPLATE_VERSION_ID,
      version: 1,
      locale: 'uz-Latn',
      status: CertificateTemplateVersionStatus.ACTIVE,
      rendererContractVersion: 'certificate-pdf-v1',
      organizationDisplayName: 'Turk Tili LMS',
      signatoryName: 'Platform rahbari',
      signatoryTitle: 'Direktor',
      fontAssetId: 'font',
      fontAssetChecksum: 'f'.repeat(64),
      fontFamily: 'Noto Sans',
      fontVersion: '0.4.2',
      fontLicenseIdentifier: 'OFL-1.1',
      fontLicenseProvenance: 'approved',
      template: { code: 'STANDARD_COURSE_COMPLETION' },
    },
  };
}

describe('PrismaCertificateArtifactRepository', () => {
  it('maps the immutable certificate rendering source explicitly', async () => {
    const findUnique = vi.fn().mockResolvedValue(databaseRenderSource());
    const repository = new PrismaCertificateArtifactRepository({
      certificate: { findUnique },
    } as unknown as PrismaClient);

    const result = await repository.findRenderSource(CERTIFICATE_ID);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CERTIFICATE_ID } }),
    );
    expect(result).toMatchObject({
      id: CERTIFICATE_ID,
      completionDate: new Date('2026-07-27T10:00:00.000Z'),
      artifactId: null,
      templateVersion: {
        id: TEMPLATE_VERSION_ID,
        templateCode: 'STANDARD_COURSE_COMPLETION',
      },
    });
  });

  it('creates finalized metadata and one safe audit record atomically', async () => {
    const artifact = artifactRecord();
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ currentTime: new Date('2026-07-28T10:01:00.000Z') }]),
      certificateArtifact: {
        create: vi.fn().mockResolvedValue(artifact),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const executeTransaction = vi
      .fn()
      .mockImplementation((operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      );
    const repository = new PrismaCertificateArtifactRepository({
      $transaction: executeTransaction,
    } as unknown as PrismaClient);

    const result = await repository.createFinalized(
      {
        certificateId: CERTIFICATE_ID,
        storageProvider: CertificateArtifactStorageProvider.LOCAL,
        storageKey: artifact.storageKey,
        mimeType: 'application/pdf',
        sizeBytes: artifact.sizeBytes,
        checksum: artifact.checksum,
        rendererIdentifier: artifact.rendererIdentifier,
        rendererVersion: artifact.rendererVersion,
      },
      certificateArtifactAuditContext,
    );

    expect(result).toEqual(artifact);
    expect(transaction.certificateArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        certificateId: CERTIFICATE_ID,
        finalizedAt: new Date('2026-07-28T10:01:00.000Z'),
        createdAt: new Date('2026-07-28T10:01:00.000Z'),
      }),
      select: expect.any(Object),
    });
    expect(transaction.auditLog.create).toHaveBeenCalledTimes(1);
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: ACTOR_ID,
        action: 'certificate.artifact_finalized',
        subjectType: 'certificate_artifact',
        subjectId: ARTIFACT_ID,
        metadata: expect.objectContaining({
          certificateId: CERTIFICATE_ID,
          checksumPrefix: artifact.checksum.slice(0, 12),
        }),
      },
    });
    expect(transaction.auditLog.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ storageKey: expect.anything() }),
        }),
      }),
    );
    expect(repository).not.toHaveProperty('update');
  });

  it.each([
    [['certificate_id'], 'certificate'],
    [['storage_key'], 'storage'],
  ] as const)('classifies only known uniqueness targets', async (target, expectedTarget) => {
    const repository = new PrismaCertificateArtifactRepository({
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '6.15.0',
          meta: { target: [...target] },
        }),
      ),
    } as unknown as PrismaClient);

    await expect(
      repository.createFinalized(
        {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: artifactRecord().storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 10n,
          checksum: 'a'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
        certificateArtifactAuditContext,
      ),
    ).rejects.toEqual(new CertificateArtifactRepositoryDuplicateError(expectedTarget));
  });

  it('maps missing certificate foreign keys without leaking Prisma details', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const repository = new PrismaCertificateArtifactRepository({
      certificate: { findUnique },
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('foreign key details', {
          code: 'P2003',
          clientVersion: '6.15.0',
        }),
      ),
    } as unknown as PrismaClient);

    await expect(
      repository.createFinalized(
        {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: artifactRecord().storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 10n,
          checksum: 'a'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
        certificateArtifactAuditContext,
      ),
    ).rejects.toBeInstanceOf(CertificateArtifactRepositoryCertificateMissingError);
  });

  it('does not misclassify an unrelated audit foreign-key failure as a missing certificate', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('foreign key details', {
      code: 'P2003',
      clientVersion: '6.15.0',
      meta: { field_name: 'audit_logs_actor_user_id_fkey' },
    });
    const repository = new PrismaCertificateArtifactRepository({
      $transaction: vi.fn().mockRejectedValue(prismaError),
    } as unknown as PrismaClient);

    await expect(
      repository.createFinalized(
        {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: artifactRecord().storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 10n,
          checksum: 'a'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
        certificateArtifactAuditContext,
      ),
    ).rejects.toBe(prismaError);
  });

  it('checks target-less foreign-key failures before classifying the certificate', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('foreign key details', {
      code: 'P2003',
      clientVersion: '6.15.0',
    });
    const findUnique = vi.fn().mockResolvedValue({ id: CERTIFICATE_ID });
    const repository = new PrismaCertificateArtifactRepository({
      certificate: { findUnique },
      $transaction: vi.fn().mockRejectedValue(prismaError),
    } as unknown as PrismaClient);

    await expect(
      repository.createFinalized(
        {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: artifactRecord().storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 10n,
          checksum: 'a'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
        certificateArtifactAuditContext,
      ),
    ).rejects.toBe(prismaError);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: CERTIFICATE_ID },
      select: { id: true },
    });
  });

  it('classifies target-less P2002 only after checking the actual unique records', async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ id: ARTIFACT_ID });
    const repository = new PrismaCertificateArtifactRepository({
      certificateArtifact: { findUnique },
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '6.15.0',
          meta: { target: null },
        }),
      ),
    } as unknown as PrismaClient);

    await expect(
      repository.createFinalized(
        {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: artifactRecord().storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 10n,
          checksum: 'a'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
        certificateArtifactAuditContext,
      ),
    ).rejects.toEqual(new CertificateArtifactRepositoryDuplicateError('certificate'));
    expect(findUnique).toHaveBeenCalledWith({
      where: { certificateId: CERTIFICATE_ID },
      select: { id: true },
    });
  });

  it('does not map unrelated uniqueness conflicts to an artifact domain conflict', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.15.0',
      meta: { target: ['audit_logs_external_unique_key'] },
    });
    const repository = new PrismaCertificateArtifactRepository({
      $transaction: vi.fn().mockRejectedValue(prismaError),
    } as unknown as PrismaClient);

    await expect(
      repository.createFinalized(
        {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: artifactRecord().storageKey,
          mimeType: 'application/pdf',
          sizeBytes: 10n,
          checksum: 'a'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
        certificateArtifactAuditContext,
      ),
    ).rejects.toBe(prismaError);
  });

  it('records one failure audit with classification and no sensitive content', async () => {
    const create = vi.fn().mockResolvedValue({});
    const repository = new PrismaCertificateArtifactRepository({
      auditLog: { create },
    } as unknown as PrismaClient);

    await repository.recordFailure(
      {
        certificateId: CERTIFICATE_ID,
        category: 'RENDER_FAILED',
        templateVersion: 1,
        rendererIdentifier: 'renderer',
        rendererVersion: 'v1',
      },
      certificateArtifactAuditContext,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: ACTOR_ID,
        action: 'certificate.artifact_finalization_failed',
        subjectType: 'certificate',
        subjectId: CERTIFICATE_ID,
        metadata: {
          category: 'RENDER_FAILED',
          templateVersion: 1,
          rendererIdentifier: 'renderer',
          rendererVersion: 'v1',
        },
      },
    });
  });
});
