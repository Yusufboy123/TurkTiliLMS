import {
  CertificateArtifactStorageProvider,
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
  CertificateLifecycleStatus,
  CertificateRevocationReasonCode,
  CertificateTemplateVersionStatus,
  CourseEnrollmentStatus,
  IdempotencyOperation,
  RoleCode,
} from '@prisma/client';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import type { CertificateArtifactUseCases } from '../../src/modules/certificate-artifacts/certificate-artifact.service.js';
import type { StepUpAuthenticationUseCases } from '../../src/modules/step-up-authentication/step-up-authentication.service.js';
import {
  CertificateIssuanceRepositoryConflictError,
  CertificateRateLimitRepositoryError,
} from '../../src/modules/certificate-issuance/certificate-issuance.errors.js';
import type {
  CertificateIssuanceRepository,
  CertificateIssuanceTransaction,
  CreateIssuedCertificateData,
  RevokeCertificateData,
} from '../../src/modules/certificate-issuance/certificate-issuance.repository.js';
import { CertificateIssuanceService } from '../../src/modules/certificate-issuance/certificate-issuance.service.js';
import type {
  CertificateActor,
  CertificateDetailRecord,
  CertificateIssuanceCandidate,
  CertificateRevocationRecord,
  IssueCertificateCommand,
  PublicCertificateRecord,
  RevokeCertificateCommand,
  StoredIdempotencyReceipt,
} from '../../src/modules/certificate-issuance/certificate-issuance.types.js';

const ADMIN_ID = '019d0000-0000-7000-8000-000000000801';
const STUDENT_ID = '019d0000-0000-7000-8000-000000000802';
const TEACHER_ID = '019d0000-0000-7000-8000-000000000803';
const SESSION_ID = '019d0000-0000-7000-8000-000000000804';
const COURSE_ID = '019d0000-0000-7000-8000-000000000805';
const ENROLLMENT_ID = '019d0000-0000-7000-8000-000000000806';
const EVALUATION_ID = '019d0000-0000-7000-8000-000000000807';
const TEMPLATE_ID = '019d0000-0000-7000-8000-000000000808';
const CERTIFICATE_ID = '019d0000-0000-7000-8000-000000000809';
const ARTIFACT_ID = '019d0000-0000-7000-8000-000000000810';
const NOW = new Date('2026-07-29T08:30:00.000Z');

function actor(
  userId = ADMIN_ID,
  roles: RoleCode[] = [RoleCode.ADMIN],
  permissions = ['certificates.issue', 'certificates.course_read', 'certificates.download'],
): CertificateActor {
  return { userId, sessionId: SESSION_ID, roles, permissions };
}

function command(overrides: Partial<IssueCertificateCommand> = {}): IssueCertificateCommand {
  return {
    enrollmentId: ENROLLMENT_ID,
    idempotencyKey: 'issue-certificate-1',
    stepUpProof: 'A'.repeat(43),
    input: {
      eligibilityEvaluationId: EVALUATION_ID,
      eligibilityEvaluationVersion: 1,
      completionVersion: 7,
      curriculumVersion: 3,
      confirmed: true,
    },
    ...overrides,
  };
}

function revokeCommand(
  overrides: Partial<RevokeCertificateCommand> = {},
): RevokeCertificateCommand {
  return {
    certificateId: CERTIFICATE_ID,
    idempotencyKey: 'revoke-certificate-0001',
    stepUpProof: 'R'.repeat(43),
    input: {
      expectedVersion: 1,
      reasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
      reasonNote: 'Tasdiqlangan ma\u2018muriy tuzatish.',
      confirmed: true,
    },
    ...overrides,
  };
}

function candidate(
  overrides: Partial<CertificateIssuanceCandidate> = {},
): CertificateIssuanceCandidate {
  return {
    enrollmentId: ENROLLMENT_ID,
    courseId: COURSE_ID,
    studentId: STUDENT_ID,
    enrollmentStatus: CourseEnrollmentStatus.COMPLETED,
    completedAt: new Date('2026-07-28T12:00:00.000Z'),
    courseTitle: 'Turk tili A1',
    courseSlug: 'turk-tili-a1',
    courseDeletedAt: null,
    recipientDisplayName: 'O\u2018quvchi',
    studentStatus: 'ACTIVE',
    studentDeletedAt: null,
    progressRoot: {
      completionVersion: 7,
      curriculumVersion: 3,
      frozenAt: new Date('2026-07-28T12:00:00.000Z'),
      completedEligibleBlocks: 4,
      totalEligibleBlocks: 4,
      completedLessons: 2,
      totalEligibleLessons: 2,
      coursePercentage: 100,
    },
    eligibility: {
      id: EVALUATION_ID,
      status: CertificateEligibilityStatus.ELIGIBLE,
      evaluationVersion: 1,
      completedAt: new Date('2026-07-28T12:00:00.000Z'),
      completionVersion: 7,
      completionCurriculumVersion: 3,
      completedLessons: 2,
      totalEligibleLessons: 2,
      coursePercentage: 100,
      policyCode: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
      policyVersion: 1,
      assessmentRule: CertificateEligibilityAssessmentRule.NONE,
      requiresAttendance: false,
      requiresManualApproval: false,
    },
    latestEligibilityEvaluationId: EVALUATION_ID,
    canonicalCompletionEventCount: 1,
    templateVersion: {
      id: TEMPLATE_ID,
      version: 1,
      locale: 'uz-Latn',
      status: CertificateTemplateVersionStatus.ACTIVE,
      rendererContractVersion: 'certificate-pdf-v1',
      organizationDisplayName: 'Turk Tili LMS',
      signatoryName: null,
      signatoryTitle: null,
      fontAssetId: 'font',
      fontAssetChecksum: 'a'.repeat(64),
      fontFamily: 'Noto Sans',
      fontVersion: '0.4.2',
      fontLicenseIdentifier: 'OFL-1.1',
      fontLicenseProvenance: 'npm package',
      templateCode: 'STANDARD_COURSE_COMPLETION',
    },
    existingCertificateId: null,
    ...overrides,
  };
}

function detail(overrides: Partial<CertificateDetailRecord> = {}): CertificateDetailRecord {
  return {
    id: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000001',
    enrollmentId: ENROLLMENT_ID,
    studentId: STUDENT_ID,
    courseId: COURSE_ID,
    courseTitle: 'Turk tili A1',
    courseSlug: 'turk-tili-a1',
    teacherId: TEACHER_ID,
    recipientDisplayName: 'O\u2018quvchi',
    organizationName: 'Turk Tili LMS',
    locale: 'uz-Latn',
    status: CertificateLifecycleStatus.ISSUED,
    version: 1,
    issuedAt: NOW,
    revokedAt: null,
    revocationReasonCode: null,
    templateVersion: 1,
    artifact: {
      id: ARTIFACT_ID,
      mimeType: 'application/pdf',
      sizeBytes: 20n,
      checksum: 'b'.repeat(64),
    },
    ...overrides,
  };
}

function setup() {
  let currentCandidate = candidate();
  let currentDetail: CertificateDetailRecord | null = detail();
  let currentReceipt: StoredIdempotencyReceipt | null = null;
  let currentRevocation: CertificateRevocationRecord | null = {
    id: CERTIFICATE_ID,
    certificateNumber: 'TTL-2026-0000000001',
    enrollmentId: ENROLLMENT_ID,
    status: CertificateLifecycleStatus.ISSUED,
    version: 1,
  };
  let currentPublic: PublicCertificateRecord | null = {
    certificateNumber: 'TTL-2026-0000000001',
    status: CertificateLifecycleStatus.ISSUED,
    recipientDisplayName: 'O\u2018quvchi',
    recipientNameSuppressedAt: null,
    courseTitle: 'Turk tili A1',
    organizationName: 'Turk Tili LMS',
    issuedAt: NOW,
    revokedAt: null,
    revocationReasonCode: null,
  };
  const created: CreateIssuedCertificateData[] = [];
  const revocations: RevokeCertificateData[] = [];
  const failures: string[] = [];
  const failureAttempts: number[] = [];
  const stepUpTransaction = {
    getDatabaseTimestamp: vi.fn(async () => NOW),
    lockSecurityState: vi.fn(),
    findSecurityContext: vi.fn(async () => ({
      userId: ADMIN_ID,
      sessionId: SESSION_ID,
      passwordHash: 'hash',
      credentialEpoch: new Date('2026-07-28T08:30:00.000Z'),
      requiresPasswordChange: false,
      credentialLockedUntil: null,
      lastAuthenticatedAt: NOW,
      roles: [RoleCode.ADMIN],
      permissions: ['certificates.revoke'],
    })),
  } as unknown as CertificateIssuanceTransaction['stepUp'];
  const transaction: CertificateIssuanceTransaction = {
    stepUp: stepUpTransaction,
    lockEvidence: vi.fn(),
    findCandidate: vi.fn(async () => currentCandidate),
    findIdempotencyRecord: vi.fn(async () => currentReceipt),
    createIssuedCertificate: vi.fn(async (data) => {
      created.push(data);
    }),
    lockCertificate: vi.fn(),
    lockIdempotencyKey: vi.fn(),
    findCertificateForRevocation: vi.fn(async () => currentRevocation),
    revokeCertificate: vi.fn(async (data) => {
      revocations.push(data);
      currentRevocation = currentRevocation
        ? {
            ...currentRevocation,
            status: CertificateLifecycleStatus.REVOKED,
            version: 2,
          }
        : null;
      currentReceipt = {
        operation: IdempotencyOperation.REVOKE_CERTIFICATE,
        requestFingerprint: data.requestFingerprint,
        responseStatus: 200,
        responseEnvelope: data.responseEnvelope,
        expiresAt: new Date(NOW.getTime() + 24 * 60 * 60_000),
      };
    }),
  };
  const repository: CertificateIssuanceRepository = {
    allocateIdentity: vi.fn(async () => ({
      certificateId: CERTIFICATE_ID,
      certificateNumber: 'TTL-2026-0000000001',
      issuedAt: NOW,
    })),
    findCandidate: vi.fn(async () => currentCandidate),
    findIdempotencyRecord: vi.fn(async () => currentReceipt),
    withSerializableTransaction: vi.fn(async (operation) => operation(transaction)),
    recordIssueRequested: vi.fn(),
    recordIssueFailed: vi.fn(async (_id, _phase, reason, attempt) => {
      failures.push(reason);
      failureAttempts.push(attempt);
    }),
    findCertificate: vi.fn(async () => currentDetail),
    recordDetailAccess: vi.fn(),
    recordPrivilegedView: vi.fn(),
    recordDownloadStarted: vi.fn(),
    verifyPublicCertificate: vi.fn(async (_hash, forceNotFound) =>
      forceNotFound ? null : currentPublic,
    ),
    findPublicCertificateByHash: vi.fn(async () => currentPublic),
  };
  const artifacts = {
    prepareCertificateArtifact: vi.fn(async () => ({
      certificateId: CERTIFICATE_ID,
      storageProvider: CertificateArtifactStorageProvider.LOCAL,
      storageKey: `certificates/2026/${CERTIFICATE_ID}/${ARTIFACT_ID}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 20,
      checksum: 'b'.repeat(64),
      rendererIdentifier: 'renderer',
      rendererVersion: '1',
    })),
    discardPreparedCertificateArtifact: vi.fn(),
    resolveFinalizedCertificateArtifact: vi.fn(async () => ({
      metadata: {
        id: ARTIFACT_ID,
        certificateId: CERTIFICATE_ID,
        storageProvider: CertificateArtifactStorageProvider.LOCAL,
        mimeType: 'application/pdf',
        sizeBytes: '20',
        checksum: 'b'.repeat(64),
        rendererIdentifier: 'renderer',
        rendererVersion: '1',
        finalizedAt: NOW.toISOString(),
        createdAt: NOW.toISOString(),
      },
      contentLength: 20,
      stream: Readable.from([Buffer.from('%PDF-1.7\n%%EOF\n')]),
    })),
  } as unknown as CertificateArtifactUseCases;
  const stepUp = {
    validateProof: vi.fn(),
    consumeProof: vi.fn(),
    validateProofInTransaction: vi.fn(async () => ({
      now: NOW,
      proof: { id: 'proof' },
    })),
    validateProofBeforeTargetLockInTransaction: vi.fn(async () => ({
      now: NOW,
      proof: { id: 'proof' },
    })),
    consumeValidatedProof: vi.fn(),
  } as unknown as StepUpAuthenticationUseCases;
  return {
    repository,
    transaction,
    artifacts,
    stepUp,
    service: new CertificateIssuanceService(repository, artifacts, stepUp),
    created,
    revocations,
    failures,
    failureAttempts,
    setCandidate(value: CertificateIssuanceCandidate) {
      currentCandidate = value;
    },
    setDetail(value: CertificateDetailRecord | null) {
      currentDetail = value;
    },
    setReceipt(value: StoredIdempotencyReceipt | null) {
      currentReceipt = value;
    },
    setRevocation(value: CertificateRevocationRecord | null) {
      currentRevocation = value;
    },
    setPublic(value: PublicCertificateRecord | null) {
      currentPublic = value;
    },
  };
}

describe('CertificateIssuanceService', () => {
  it('prepares an artifact and atomically consumes proof, certificate, audit data, and receipt', async () => {
    const context = setup();
    const result = await context.service.issueCertificate(command(), actor(), {
      actorUserId: ADMIN_ID,
    });

    expect(result.response.data).toMatchObject({
      operation: 'ISSUE',
      certificateId: CERTIFICATE_ID,
      resultingStatus: 'ISSUED',
      resultingVersion: 1,
    });
    expect(context.stepUp.validateProof).toHaveBeenCalledOnce();
    expect(context.stepUp.validateProofBeforeTargetLockInTransaction).toHaveBeenCalledOnce();
    expect(context.stepUp.validateProofInTransaction).not.toHaveBeenCalled();
    expect(context.stepUp.consumeValidatedProof).toHaveBeenCalledOnce();
    expect(context.transaction.lockEvidence).toHaveBeenCalledWith(
      ENROLLMENT_ID,
      EVALUATION_ID,
      TEMPLATE_ID,
    );
    expect(context.created).toHaveLength(1);
    expect(context.created[0]?.responseEnvelope).toEqual(result.response);
    expect(result.location).toBe(`/api/v1/courses/${COURSE_ID}/certificates/${CERTIFICATE_ID}`);
    expect(context.artifacts.discardPreparedCertificateArtifact).not.toHaveBeenCalled();
  });

  it('delivers the raw verification capability to rendering and persists only its hash', async () => {
    const context = setup();
    const result = await context.service.issueCertificate(command(), actor(), {
      actorUserId: ADMIN_ID,
    });
    const preparation = vi.mocked(context.artifacts.prepareCertificateArtifact).mock.calls[0]?.[0];
    const renderInput = preparation?.renderInput as { verificationIdentifier?: string };
    const raw = renderInput.verificationIdentifier;
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(context.created[0]?.verificationTokenHash).toBe(
      createHash('sha256').update(raw!).digest('hex'),
    );
    expect(
      JSON.stringify(context.created, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ).not.toContain(raw);
    expect(JSON.stringify(result)).not.toContain(raw);
    expect(
      JSON.stringify(vi.mocked(context.repository.recordIssueRequested).mock.calls),
    ).not.toContain(raw);
  });

  it.each([
    ['recipient display name', { recipientDisplayName: 'Yangilangan ism' }],
    ['course title', { courseTitle: 'Yangilangan kurs' }],
  ])(
    'aborts when %s changes between render and commit without consuming proof',
    async (_label, change) => {
      const context = setup();
      vi.mocked(context.artifacts.prepareCertificateArtifact).mockImplementationOnce(async () => {
        context.setCandidate(candidate(change));
        return {
          certificateId: CERTIFICATE_ID,
          storageProvider: CertificateArtifactStorageProvider.LOCAL,
          storageKey: `certificates/2026/${CERTIFICATE_ID}/${ARTIFACT_ID}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 20,
          checksum: 'b'.repeat(64),
          rendererIdentifier: 'renderer',
          rendererVersion: '1',
        };
      });
      await expect(
        context.service.issueCertificate(command(), actor(), { actorUserId: ADMIN_ID }),
      ).rejects.toMatchObject({ code: 'CERTIFICATE_EVIDENCE_CONFLICT' });
      expect(context.stepUp.consumeValidatedProof).not.toHaveBeenCalled();
      expect(context.created).toHaveLength(0);
      expect(context.artifacts.discardPreparedCertificateArtifact).toHaveBeenCalledOnce();
    },
  );

  it('binds the rendered artifact renderer identity and version into the snapshot fingerprint', async () => {
    const context = setup();
    const prepared = {
      certificateId: CERTIFICATE_ID,
      storageProvider: CertificateArtifactStorageProvider.LOCAL,
      storageKey: `certificates/2026/${CERTIFICATE_ID}/${ARTIFACT_ID}.pdf`,
      mimeType: 'application/pdf' as const,
      sizeBytes: 20,
      checksum: 'b'.repeat(64),
      rendererIdentifier: 'renderer',
      rendererVersion: '1',
    };
    vi.mocked(context.artifacts.prepareCertificateArtifact).mockResolvedValueOnce(prepared);
    vi.mocked(context.transaction.lockEvidence).mockImplementationOnce(() => {
      prepared.rendererVersion = '2';
      return Promise.resolve();
    });

    await expect(
      context.service.issueCertificate(command(), actor(), { actorUserId: ADMIN_ID }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_EVIDENCE_CONFLICT' });
    expect(context.stepUp.consumeValidatedProof).not.toHaveBeenCalled();
    expect(context.created).toHaveLength(0);
    expect(context.artifacts.discardPreparedCertificateArtifact).toHaveBeenCalledOnce();
  });

  it('replays an identical successful request without proof consumption or rendering', async () => {
    const context = setup();
    const first = await context.service.issueCertificate(command(), actor(), {
      actorUserId: ADMIN_ID,
    });
    context.setReceipt({
      operation: IdempotencyOperation.ISSUE_CERTIFICATE,
      requestFingerprint: context.created[0]!.requestFingerprint,
      responseStatus: 201,
      responseEnvelope: first.response,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });

    const replayed = await context.service.issueCertificate(command(), actor(), {
      actorUserId: ADMIN_ID,
    });
    expect(replayed).toEqual(first);
    expect(context.artifacts.prepareCertificateArtifact).toHaveBeenCalledOnce();
    expect(context.stepUp.validateProof).toHaveBeenCalledOnce();
  });

  it('rejects reuse of an idempotency key for a different body', async () => {
    const context = setup();
    context.setReceipt({
      operation: IdempotencyOperation.ISSUE_CERTIFICATE,
      requestFingerprint: 'f'.repeat(64),
      responseStatus: 201,
      responseEnvelope: {},
      expiresAt: NOW,
    });
    await expect(
      context.service.issueCertificate(command(), actor(), { actorUserId: ADMIN_ID }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('enforces ADMIN role and permission for direct service calls', async () => {
    const context = setup();
    await expect(
      context.service.issueCertificate(
        command(),
        actor(TEACHER_ID, [RoleCode.TEACHER], ['certificates.issue']),
        { actorUserId: TEACHER_ID },
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it.each([
    [
      'not completed',
      candidate({ enrollmentStatus: CourseEnrollmentStatus.ACTIVE }),
      'CERTIFICATE_NOT_ELIGIBLE',
    ],
    ['no eligible evidence', candidate({ eligibility: null }), 'CERTIFICATE_NOT_ELIGIBLE'],
    [
      'stale evidence',
      candidate({ latestEligibilityEvaluationId: '019d0000-0000-7000-8000-000000000899' }),
      'CERTIFICATE_EVIDENCE_CONFLICT',
    ],
    [
      'duplicate certificate',
      candidate({ existingCertificateId: CERTIFICATE_ID }),
      'CERTIFICATE_ALREADY_ISSUED',
    ],
    [
      'no active template',
      candidate({ templateVersion: null }),
      'CERTIFICATE_TEMPLATE_UNAVAILABLE',
    ],
  ])('rejects %s before rendering', async (_label, value, code) => {
    const context = setup();
    context.setCandidate(value);
    await expect(
      context.service.issueCertificate(command(), actor(), { actorUserId: ADMIN_ID }),
    ).rejects.toMatchObject({ code });
    expect(context.artifacts.prepareCertificateArtifact).not.toHaveBeenCalled();
  });

  it('removes the finalized object when the final transaction fails', async () => {
    const context = setup();
    vi.mocked(context.repository.withSerializableTransaction).mockRejectedValueOnce(
      new CertificateIssuanceRepositoryConflictError('serialization'),
    );
    await expect(
      context.service.issueCertificate(command(), actor(), { actorUserId: ADMIN_ID }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ISSUANCE_CONFLICT' });
    expect(context.artifacts.discardPreparedCertificateArtifact).toHaveBeenCalledOnce();
    expect(context.failures).toEqual(['CERTIFICATE_ISSUANCE_CONFLICT']);
    expect(context.failureAttempts).toEqual([1]);
  });

  it('hides another student certificate as not found', async () => {
    const context = setup();
    await expect(
      context.service.getOwnCertificate(
        CERTIFICATE_ID,
        actor(
          '019d0000-0000-7000-8000-000000000811',
          [RoleCode.STUDENT],
          ['certificates.self_read'],
        ),
        { actorUserId: STUDENT_ID },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_NOT_FOUND' });
    expect(context.repository.recordDetailAccess).not.toHaveBeenCalled();
  });

  it('allows only the assigned teacher to read course-scoped detail and audits success', async () => {
    const context = setup();
    const teacher = actor(TEACHER_ID, [RoleCode.TEACHER], ['certificates.course_read']);
    await expect(
      context.service.getCourseCertificate(COURSE_ID, CERTIFICATE_ID, teacher, {
        actorUserId: TEACHER_ID,
      }),
    ).resolves.toMatchObject({ id: CERTIFICATE_ID });
    expect(context.repository.recordPrivilegedView).toHaveBeenCalledOnce();

    await expect(
      context.service.getCourseCertificate(
        COURSE_ID,
        CERTIFICATE_ID,
        actor(
          '019d0000-0000-7000-8000-000000000812',
          [RoleCode.TEACHER],
          ['certificates.course_read'],
        ),
        { actorUserId: TEACHER_ID },
      ),
    ).rejects.toMatchObject({ code: 'COURSE_SCOPE_DENIED' });
  });

  it('applies the shared detail limiter after ownership authorization', async () => {
    const context = setup();
    await context.service.getOwnCertificate(
      CERTIFICATE_ID,
      actor(STUDENT_ID, [RoleCode.STUDENT], ['certificates.self_read']),
      { actorUserId: STUDENT_ID },
    );
    expect(context.repository.recordDetailAccess).toHaveBeenCalledWith(
      CERTIFICATE_ID,
      'self',
      expect.objectContaining({ actorUserId: STUDENT_ID }),
    );
  });

  it('emits a safe operational alert for corrupt artifacts and audit persistence failure', async () => {
    const context = setup();
    const alerts: unknown[] = [];
    vi.mocked(context.artifacts.resolveFinalizedCertificateArtifact).mockRejectedValueOnce(
      new Error('private storage path C:\\secret\\artifact.pdf'),
    );
    await expect(
      context.service.downloadOwnCertificate(
        CERTIFICATE_ID,
        actor(STUDENT_ID, [RoleCode.STUDENT], ['certificates.self_download']),
        {
          actorUserId: STUDENT_ID,
          reportOperationalAlert: (alert) => alerts.push(alert),
        },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ARTIFACT_UNAVAILABLE' });
    expect(alerts).toEqual([
      expect.objectContaining({
        event: 'certificate.artifact_integrity_alert',
        certificateId: CERTIFICATE_ID,
        artifactId: ARTIFACT_ID,
      }),
    ]);
    expect(JSON.stringify(alerts)).not.toContain('C:\\secret');

    const failed = setup();
    vi.mocked(failed.repository.withSerializableTransaction).mockRejectedValueOnce(
      new CertificateIssuanceRepositoryConflictError('serialization', 3),
    );
    vi.mocked(failed.repository.recordIssueFailed).mockRejectedValueOnce(new Error('db secret'));
    const failureAlerts: unknown[] = [];
    await expect(
      failed.service.issueCertificate(command(), actor(), {
        actorUserId: ADMIN_ID,
        reportOperationalAlert: (alert) => failureAlerts.push(alert),
      }),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ISSUANCE_CONFLICT' });
    expect(failed.repository.recordIssueFailed).toHaveBeenCalledWith(
      ENROLLMENT_ID,
      'commit',
      'CERTIFICATE_ISSUANCE_CONFLICT',
      3,
      expect.any(Object),
    );
    expect(failureAlerts).toEqual([
      expect.objectContaining({
        event: 'certificate.audit_persistence_failed',
        classification: 'ISSUE_FAILED_AUDIT_PERSISTENCE',
      }),
    ]);
    expect(JSON.stringify(failureAlerts)).not.toContain('db secret');
  });

  it('streams only the stored verified artifact and audits before returning', async () => {
    const context = setup();
    const download = await context.service.downloadOwnCertificate(
      CERTIFICATE_ID,
      actor(STUDENT_ID, [RoleCode.STUDENT], ['certificates.self_download']),
      { actorUserId: STUDENT_ID },
    );
    expect(download.checksum).toBe('b'.repeat(64));
    expect(context.artifacts.resolveFinalizedCertificateArtifact).toHaveBeenCalledWith(ARTIFACT_ID);
    expect(context.repository.recordDownloadStarted).toHaveBeenCalledWith(
      CERTIFICATE_ID,
      'student',
      expect.any(Object),
    );
  });

  it('denies student download after revocation but permits audited ADMIN retrieval', async () => {
    const context = setup();
    context.setDetail(
      detail({
        status: CertificateLifecycleStatus.REVOKED,
        version: 2,
        revokedAt: NOW,
      }),
    );
    await expect(
      context.service.downloadOwnCertificate(
        CERTIFICATE_ID,
        actor(STUDENT_ID, [RoleCode.STUDENT], ['certificates.self_download']),
        { actorUserId: STUDENT_ID },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_REVOKED' });
    await expect(
      context.service.downloadCourseCertificate(COURSE_ID, CERTIFICATE_ID, actor(), {
        actorUserId: ADMIN_ID,
      }),
    ).resolves.toMatchObject({ certificateId: CERTIFICATE_ID });
  });

  it('hashes the public identifier and returns only the approved immutable projection', async () => {
    const context = setup();
    const token = 'P'.repeat(43);
    const result = await context.service.verifyPublicCertificate(token, {
      ipHash: 'a'.repeat(64),
    });

    expect(context.repository.verifyPublicCertificate).toHaveBeenCalledWith(
      createHash('sha256').update(token).digest('hex'),
      false,
      { ipHash: 'a'.repeat(64) },
    );
    expect(result).toEqual({
      certificateNumber: 'TTL-2026-0000000001',
      status: 'VALID',
      recipientDisplayName: 'O\u2018quvchi',
      courseTitle: 'Turk tili A1',
      organizationName: 'Turk Tili LMS',
      issuedAt: NOW.toISOString(),
      revokedAt: null,
      safeRevocationReasonCode: null,
    });
    expect(Object.keys(result)).not.toEqual(
      expect.arrayContaining(['id', 'level', 'verificationTokenHash', 'artifact']),
    );
  });

  it('applies privacy suppression and exposes only safe revoked fields', async () => {
    const context = setup();
    context.setPublic({
      certificateNumber: 'TTL-2026-0000000001',
      status: CertificateLifecycleStatus.REVOKED,
      recipientDisplayName: 'Yashirin ism',
      recipientNameSuppressedAt: NOW,
      courseTitle: 'Turk tili A1',
      organizationName: 'Turk Tili LMS',
      issuedAt: NOW,
      revokedAt: NOW,
      revocationReasonCode: CertificateRevocationReasonCode.FRAUD,
    });

    await expect(
      context.service.verifyPublicCertificate('Q'.repeat(43), {
        ipHash: 'b'.repeat(64),
      }),
    ).resolves.toEqual({
      certificateNumber: 'TTL-2026-0000000001',
      status: 'REVOKED',
      recipientDisplayName: null,
      courseTitle: 'Turk tili A1',
      organizationName: 'Turk Tili LMS',
      issuedAt: NOW.toISOString(),
      revokedAt: NOW.toISOString(),
      safeRevocationReasonCode: CertificateRevocationReasonCode.FRAUD,
    });
  });

  it('uses the same 404 for malformed and unknown verification identifiers', async () => {
    const malformed = setup();
    await expect(
      malformed.service.verifyPublicCertificate('not-a-token', {
        ipHash: 'c'.repeat(64),
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CERTIFICATE_VERIFICATION_NOT_FOUND',
    });
    expect(malformed.repository.verifyPublicCertificate).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/u),
      true,
      expect.any(Object),
    );

    const unknown = setup();
    unknown.setPublic(null);
    await expect(
      unknown.service.verifyPublicCertificate('U'.repeat(43), {
        ipHash: 'd'.repeat(64),
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CERTIFICATE_VERIFICATION_NOT_FOUND',
    });
  });

  it('fails public telemetry open but preserves the shared rate limit', async () => {
    const telemetryFailure = setup();
    vi.mocked(telemetryFailure.repository.verifyPublicCertificate).mockRejectedValueOnce(
      new Error('telemetry unavailable'),
    );
    await expect(
      telemetryFailure.service.verifyPublicCertificate('T'.repeat(43), {
        ipHash: 'e'.repeat(64),
      }),
    ).resolves.toMatchObject({ status: 'VALID' });
    expect(telemetryFailure.repository.findPublicCertificateByHash).toHaveBeenCalledOnce();

    const rateLimited = setup();
    vi.mocked(rateLimited.repository.verifyPublicCertificate).mockRejectedValueOnce(
      new CertificateRateLimitRepositoryError(),
    );
    await expect(
      rateLimited.service.verifyPublicCertificate('T'.repeat(43), {
        ipHash: 'f'.repeat(64),
      }),
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' });
    expect(rateLimited.repository.findPublicCertificateByHash).not.toHaveBeenCalled();
  });

  it('atomically revokes an issued certificate with proof, audit data, and a receipt', async () => {
    const context = setup();
    const result = await context.service.revokeCertificate(
      revokeCommand(),
      actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.revoke']),
      { actorUserId: ADMIN_ID },
    );

    expect(result.data).toMatchObject({
      operation: 'REVOKE',
      certificateId: CERTIFICATE_ID,
      resultingStatus: 'REVOKED',
      resultingVersion: 2,
    });
    expect(context.transaction.lockCertificate).toHaveBeenCalledWith(CERTIFICATE_ID);
    expect(context.transaction.lockIdempotencyKey).toHaveBeenCalledWith(
      ADMIN_ID,
      'revoke-certificate-0001',
    );
    expect(context.stepUp.validateProofBeforeTargetLockInTransaction).toHaveBeenCalledWith(
      context.transaction.stepUp,
      expect.objectContaining({
        action: 'CERTIFICATE_REVOKE',
        targetType: 'CERTIFICATE',
        targetId: CERTIFICATE_ID,
      }),
      expect.objectContaining({ userId: ADMIN_ID }),
    );
    expect(context.stepUp.consumeValidatedProof).toHaveBeenCalledOnce();
    expect(context.revocations).toHaveLength(1);
    expect(context.revocations[0]).toMatchObject({
      actorUserId: ADMIN_ID,
      reasonCode: CertificateRevocationReasonCode.ADMINISTRATIVE_ERROR,
      responseEnvelope: result,
    });
  });

  it('replays revocation exactly without consuming proof or writing twice', async () => {
    const context = setup();
    const admin = actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.revoke']);
    const first = await context.service.revokeCertificate(revokeCommand(), admin, {
      actorUserId: ADMIN_ID,
    });
    vi.mocked(context.stepUp.consumeValidatedProof).mockClear();
    const second = await context.service.revokeCertificate(
      { ...revokeCommand(), stepUpProof: 'Z'.repeat(43) },
      admin,
      { actorUserId: ADMIN_ID },
    );

    expect(second).toEqual(first);
    expect(context.revocations).toHaveLength(1);
    expect(context.stepUp.consumeValidatedProof).not.toHaveBeenCalled();
  });

  it('rejects direct-service authorization, lifecycle, version, and idempotency violations', async () => {
    const unauthorized = setup();
    await expect(
      unauthorized.service.revokeCertificate(
        revokeCommand(),
        actor(STUDENT_ID, [RoleCode.STUDENT], ['certificates.revoke']),
        { actorUserId: STUDENT_ID },
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' });

    const missing = setup();
    missing.setRevocation(null);
    await expect(
      missing.service.revokeCertificate(
        revokeCommand(),
        actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.revoke']),
        { actorUserId: ADMIN_ID },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_NOT_FOUND' });

    const revoked = setup();
    revoked.setRevocation({
      id: CERTIFICATE_ID,
      certificateNumber: 'TTL-2026-0000000001',
      enrollmentId: ENROLLMENT_ID,
      status: CertificateLifecycleStatus.REVOKED,
      version: 2,
    });
    await expect(
      revoked.service.revokeCertificate(
        revokeCommand(),
        actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.revoke']),
        { actorUserId: ADMIN_ID },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_ALREADY_REVOKED' });

    const version = setup();
    await expect(
      version.service.revokeCertificate(
        revokeCommand({
          input: {
            ...revokeCommand().input,
            expectedVersion: 2,
          },
        }),
        actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.revoke']),
        { actorUserId: ADMIN_ID },
      ),
    ).rejects.toMatchObject({ code: 'CERTIFICATE_VERSION_CONFLICT' });

    const idempotency = setup();
    const admin = actor(ADMIN_ID, [RoleCode.ADMIN], ['certificates.revoke']);
    await idempotency.service.revokeCertificate(revokeCommand(), admin, {
      actorUserId: ADMIN_ID,
    });
    await expect(
      idempotency.service.revokeCertificate(
        revokeCommand({
          input: {
            ...revokeCommand().input,
            reasonCode: CertificateRevocationReasonCode.FRAUD,
          },
        }),
        admin,
        { actorUserId: ADMIN_ID },
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});
