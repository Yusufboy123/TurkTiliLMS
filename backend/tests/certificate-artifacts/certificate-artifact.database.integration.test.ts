import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CertificateArtifactStorageProvider,
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  CertificateTemplateVersionStatus,
  CourseEnrollmentSource,
  CourseEnrollmentStatus,
  CourseStatus,
  PrismaClient,
} from '@prisma/client';
import {
  CERTIFICATE_PDF_MIME_TYPE,
  CERTIFICATE_RENDERER_CONTRACT_VERSION,
  CERTIFICATE_RENDERER_IDENTIFIER,
  CERTIFICATE_RENDERER_VERSION,
  CERTIFICATE_TEMPLATE_CODE,
  CERTIFICATE_TEMPLATE_VERSION,
} from '../../src/modules/certificate-artifacts/certificate-artifact.constants.js';
import { PackageNotoSansFontSource } from '../../src/modules/certificate-artifacts/certificate-font-source.js';
import {
  calculateSha256,
  calculateStreamSha256,
} from '../../src/modules/certificate-artifacts/certificate-artifact.integrity.js';
import {
  PrismaCertificateArtifactRepository,
  type CertificateArtifactRepository,
} from '../../src/modules/certificate-artifacts/certificate-artifact.repository.js';
import { PdfKitCertificateRenderer } from '../../src/modules/certificate-artifacts/certificate-artifact.renderer.js';
import { CertificateArtifactService } from '../../src/modules/certificate-artifacts/certificate-artifact.service.js';
import { LocalCertificateArtifactStorage } from '../../src/modules/certificate-artifacts/certificate-artifact.storage.js';
import { normalizeCertificateRenderInput } from '../../src/modules/certificate-artifacts/certificate-render-input.js';
import type {
  CertificateArtifactAuditContext,
  CertificateArtifactFailureAudit,
  CertificateArtifactRecord,
  CertificateRenderSourceRecord,
  CreateCertificateArtifactData,
} from '../../src/modules/certificate-artifacts/certificate-artifact.types.js';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');

function schemaSuffix(): string {
  return randomUUID().replaceAll('-', '');
}

function utcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

describeDatabase('Module 8.6D certificate artifact PostgreSQL lifecycle', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `certificate_artifact_test_${schemaSuffix()}`;
  let isolatedDatabaseUrl = '';
  let client: PrismaClient;
  let repository: PrismaCertificateArtifactRepository;
  let renderer: PdfKitCertificateRenderer;
  let storage: LocalCertificateArtifactStorage;
  let storageRoot = '';
  let actorUserId = '';
  let courseId = '';
  let policyId = '';
  let templateVersionId = '';

  async function deployMigrations(databaseUrl: string): Promise<void> {
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      windowsHide: true,
    });
  }

  async function createCertificate(label: string) {
    const student = await client.user.create({
      data: { email: `artifact-${label}-${randomUUID()}@example.com` },
    });
    const completedAt = new Date('2026-07-27T10:00:00.000Z');
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId,
        studentId: student.id,
        source: CourseEnrollmentSource.SELF,
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt,
      },
    });
    await client.enrollmentProgressRoot.create({
      data: {
        enrollmentId: enrollment.id,
        curriculumVersion: 1,
        completionVersion: 1,
        completedEligibleBlocks: 1,
        totalEligibleBlocks: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        frozenAt: completedAt,
      },
    });
    const evaluation = await client.certificateEligibilityEvaluation.create({
      data: {
        enrollmentId: enrollment.id,
        courseId,
        policyId,
        status: CertificateEligibilityStatus.ELIGIBLE,
        evaluationVersion: 1,
        evaluatedAt: completedAt,
        completedAt,
        completionCurriculumVersion: 1,
        completionVersion: 1,
        completedLessons: 1,
        totalEligibleLessons: 1,
        coursePercentage: 100,
        evaluatorType: CertificateEligibilityEvaluatorType.SYSTEM,
      },
    });
    const issuedAt = new Date('2026-07-28T10:00:00.000Z');
    return client.certificate.create({
      data: {
        verificationTokenHash: Buffer.from(randomUUID())
          .toString('hex')
          .padEnd(64, '0')
          .slice(0, 64),
        enrollmentId: enrollment.id,
        courseId,
        eligibilityEvaluationId: evaluation.id,
        templateVersionId,
        recipientDisplayName: `O‘quvchi ${label}`,
        courseTitle: 'Turk tili A1',
        organizationName: 'Turk Tili LMS',
        locale: 'uz-Latn',
        issueDate: utcDate(issuedAt),
        issuedAt,
        issuedByUserId: actorUserId,
      },
      include: {
        eligibilityEvaluation: { select: { completedAt: true } },
        templateVersion: { include: { template: true } },
      },
    });
  }

  function inputFor(certificate: Awaited<ReturnType<typeof createCertificate>>) {
    return {
      certificateId: certificate.id,
      certificateNumber: certificate.certificateNumber,
      recipientDisplayName: certificate.recipientDisplayName,
      courseTitle: certificate.courseTitle,
      completionDate: certificate.eligibilityEvaluation.completedAt.toISOString().slice(0, 10),
      issueDate: certificate.issueDate.toISOString().slice(0, 10),
      issuedAt: certificate.issuedAt.toISOString(),
      organizationName: certificate.organizationName,
      locale: certificate.locale,
      templateCode: certificate.templateVersion.template.code,
      templateVersionId: certificate.templateVersion.id,
      templateVersion: certificate.templateVersion.version,
      rendererContractVersion: certificate.templateVersion.rendererContractVersion,
      signatoryName: certificate.templateVersion.signatoryName,
      signatoryTitle: certificate.templateVersion.signatoryTitle,
    };
  }

  function serviceWith(artifactRepository: CertificateArtifactRepository = repository) {
    return new CertificateArtifactService(artifactRepository, renderer, storage, 10_485_760);
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^certificate_artifact_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated database schema name is invalid.');
    }
    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    isolatedDatabaseUrl = url.toString();
    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${schemaName}"."citext" AS public.citext`,
    );
    await deployMigrations(isolatedDatabaseUrl);
    client = new PrismaClient({ datasourceUrl: isolatedDatabaseUrl });
    repository = new PrismaCertificateArtifactRepository(client);
    storageRoot = await mkdtemp(join(tmpdir(), 'turk-tili-certificate-db-storage-'));
    storage = new LocalCertificateArtifactStorage(storageRoot, 10_485_760);
    renderer = new PdfKitCertificateRenderer(new PackageNotoSansFontSource(), 10_000, 10_485_760);

    const actor = await client.user.create({
      data: { email: `artifact-admin-${randomUUID()}@example.com` },
    });
    actorUserId = actor.id;
    const course = await client.course.create({
      data: {
        title: 'Turk tili A1',
        slug: `artifact-course-${randomUUID()}`,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
    });
    courseId = course.id;
    const policy = await client.certificateEligibilityPolicy.create({
      data: {
        code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
        version: 1,
        assessmentRule: CertificateEligibilityAssessmentRule.NONE,
      },
    });
    policyId = policy.id;
    const template = await client.certificateTemplate.create({
      data: { code: CERTIFICATE_TEMPLATE_CODE, name: 'Standard Course Completion' },
    });
    const fonts = await renderer.fontManifest();
    const activatedAt = new Date('2026-07-28T09:00:00.000Z');
    const version = await client.certificateTemplateVersion.create({
      data: {
        templateId: template.id,
        version: CERTIFICATE_TEMPLATE_VERSION,
        locale: 'uz-Latn',
        status: CertificateTemplateVersionStatus.ACTIVE,
        rendererContractVersion: CERTIFICATE_RENDERER_CONTRACT_VERSION,
        organizationDisplayName: 'Turk Tili LMS',
        organizationLegalName: 'Turk Tili LMS',
        signatoryName: 'Platform rahbari',
        signatoryTitle: 'Direktor',
        fontAssetId: fonts.assetId,
        fontAssetChecksum: fonts.checksum,
        fontFamily: fonts.family,
        fontVersion: fonts.version,
        fontLicenseIdentifier: fonts.licenseIdentifier,
        fontLicenseProvenance: fonts.licenseProvenance,
        activatedAt,
        createdAt: new Date(activatedAt.getTime() - 1),
      },
    });
    templateVersionId = version.id;
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    await rm(storageRoot, { recursive: true, force: true });
    if (/^certificate_artifact_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    await administrationClient.$disconnect();
  });

  it('persists metadata only after real PDF storage finalization', async () => {
    const certificate = await createCertificate('success');
    const audit: CertificateArtifactAuditContext = { actorUserId };
    expect(
      await client.certificateArtifact.count({ where: { certificateId: certificate.id } }),
    ).toBe(0);

    const result = await serviceWith().finalizeCertificateArtifact({
      certificateId: certificate.id,
      renderInput: inputFor(certificate),
      audit,
    });
    const persisted = await client.certificateArtifact.findUniqueOrThrow({
      where: { certificateId: certificate.id },
    });
    const opened = await storage.open(persisted.storageKey);
    const integrity = await calculateStreamSha256(opened.stream);

    expect(result).not.toHaveProperty('storageKey');
    expect(result).not.toHaveProperty('path');
    expect(persisted).toMatchObject({
      mimeType: CERTIFICATE_PDF_MIME_TYPE,
      storageProvider: CertificateArtifactStorageProvider.LOCAL,
      rendererIdentifier: CERTIFICATE_RENDERER_IDENTIFIER,
      rendererVersion: CERTIFICATE_RENDERER_VERSION,
    });
    expect(persisted.finalizedAt).toEqual(persisted.createdAt);
    expect(integrity).toEqual({
      checksum: persisted.checksum,
      sizeBytes: Number(persisted.sizeBytes),
    });
    expect(
      await client.auditLog.count({
        where: {
          action: 'certificate.artifact_finalized',
          subjectId: persisted.id,
        },
      }),
    ).toBe(1);
  });

  it('enforces one immutable finalized artifact and exposes no status field', async () => {
    const certificate = await createCertificate('immutable');
    const result = await serviceWith().finalizeCertificateArtifact({
      certificateId: certificate.id,
      renderInput: inputFor(certificate),
      audit: { actorUserId },
    });

    await expect(
      serviceWith().finalizeCertificateArtifact({
        certificateId: certificate.id,
        renderInput: inputFor(certificate),
        audit: { actorUserId },
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ARTIFACT_ALREADY_EXISTS' });
    await expect(
      client.certificateArtifact.update({
        where: { id: result.id },
        data: { rendererVersion: 'changed' },
      }),
    ).rejects.toThrow(/certificate artifact metadata is immutable/u);
    const statusColumns = await client.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::BIGINT AS count
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = 'certificate_artifacts'
        AND column_name = 'status'
    `;
    expect(statusColumns[0]?.count).toBe(0n);
  });

  it('compensates finalized storage after a real audit actor foreign-key failure', async () => {
    const certificate = await createCertificate('audit-foreign-key');

    await expect(
      serviceWith().finalizeCertificateArtifact({
        certificateId: certificate.id,
        renderInput: inputFor(certificate),
        audit: { actorUserId: randomUUID() },
      }),
    ).rejects.toMatchObject({
      code: 'CERTIFICATE_ARTIFACT_PERSISTENCE_FAILED',
    });

    expect(
      await client.certificateArtifact.count({ where: { certificateId: certificate.id } }),
    ).toBe(0);
    const files = await readdir(storageRoot, { recursive: true });
    expect(
      files.filter((entry) => entry.includes(certificate.id) && entry.endsWith('.pdf')),
    ).toHaveLength(0);
  });

  it('compensates real finalized storage after a database uniqueness race', async () => {
    const certificate = await createCertificate('race');
    const competingPdf = await renderer.render(
      normalizeCertificateRenderInput(inputFor(certificate)),
    );
    const competingReceipt = await storage.finalize(
      await storage.stage({
        certificateId: certificate.id,
        issuedYear: 2026,
        bytes: competingPdf.bytes,
        checksum: calculateSha256(competingPdf.bytes),
      }),
    );
    const racingRepository: CertificateArtifactRepository = {
      findRenderSource: (id: string): Promise<CertificateRenderSourceRecord | null> =>
        repository.findRenderSource(id),
      findById: (id: string): Promise<CertificateArtifactRecord | null> => repository.findById(id),
      findByCertificateId: (id: string): Promise<CertificateArtifactRecord | null> =>
        repository.findByCertificateId(id),
      createFinalized: async (
        data: CreateCertificateArtifactData,
        context: CertificateArtifactAuditContext,
      ): Promise<CertificateArtifactRecord> => {
        await client.certificateArtifact.create({
          data: {
            certificateId: certificate.id,
            storageProvider: competingReceipt.storageProvider,
            storageKey: competingReceipt.storageKey,
            mimeType: CERTIFICATE_PDF_MIME_TYPE,
            sizeBytes: BigInt(competingReceipt.sizeBytes),
            checksum: competingReceipt.checksum,
            rendererIdentifier: competingPdf.rendererIdentifier,
            rendererVersion: competingPdf.rendererVersion,
            finalizedAt: new Date('2026-07-28T10:00:00.000Z'),
            createdAt: new Date('2026-07-28T10:00:00.000Z'),
          },
        });
        return repository.createFinalized(data, context);
      },
      recordFailure: (
        failure: CertificateArtifactFailureAudit,
        context: CertificateArtifactAuditContext,
      ): Promise<void> => repository.recordFailure(failure, context),
    };

    await expect(
      serviceWith(racingRepository).finalizeCertificateArtifact({
        certificateId: certificate.id,
        renderInput: inputFor(certificate),
        audit: { actorUserId },
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ARTIFACT_ALREADY_EXISTS' });

    const files = await readdir(storageRoot, { recursive: true });
    expect(
      files.filter((entry) => entry.includes(certificate.id) && entry.endsWith('.pdf')),
    ).toHaveLength(1);
    expect(
      await client.certificateArtifact.count({ where: { certificateId: certificate.id } }),
    ).toBe(1);
    const winningObject = await storage.open(competingReceipt.storageKey);
    await expect(calculateStreamSha256(winningObject.stream)).resolves.toEqual({
      checksum: competingReceipt.checksum,
      sizeBytes: competingReceipt.sizeBytes,
    });
  });
});
