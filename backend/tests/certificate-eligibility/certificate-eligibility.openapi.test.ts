import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const contractPath = fileURLToPath(
  new URL(
    '../../../docs/openapi/course-completion-certificate-eligibility.v1.yaml',
    import.meta.url,
  ),
);

describe('Certificate eligibility and lifecycle OpenAPI runtime markers', () => {
  it('marks all approved operations through Module 8.6F available', async () => {
    const contract = await readFile(contractPath, 'utf8');
    expect(contract.match(/x-implementation-status: implemented/g)).toHaveLength(13);
    expect(contract).not.toContain('x-implementation-status: contract-only-not-available');
    for (const operationId of [
      'getOwnCertificateEligibility',
      'getOwnCertificateStatus',
      'getCourseEnrollmentCertificateEligibility',
      'getCourseEnrollmentCertificateStatus',
      'createStepUpChallenge',
      'verifyStepUpChallenge',
      'issueEnrollmentCertificate',
      'getOwnCertificate',
      'downloadOwnCertificate',
      'getCourseCertificate',
      'downloadCourseCertificate',
      'revokeCertificate',
      'verifyPublicCertificate',
    ]) {
      expect(contract).toContain(`operationId: ${operationId}`);
    }
  });

  it('documents the exact public verification and revocation contracts', async () => {
    const contract = await readFile(contractPath, 'utf8');
    for (const operationId of ['revokeCertificate', 'verifyPublicCertificate']) {
      const operation = contract.slice(contract.indexOf(`operationId: ${operationId}\n`));
      expect(operation.slice(0, operation.indexOf('      responses:'))).toContain(
        'x-implementation-status: implemented',
      );
    }
    expect(contract).toContain('security: []');
    expect(contract).toContain('code: CERTIFICATE_VERIFICATION_NOT_FOUND');
    expect(contract).toContain('x-audit-event: certificate.verification_viewed');
    expect(contract).toContain('x-audit-event: certificate.revoked');
    expect(contract).not.toContain('certificate.public_verified');
    expect(contract).not.toContain('certificate.public_not_found');
    const publicSchema = contract.slice(
      contract.indexOf('    PublicCertificateVerification:'),
      contract.indexOf('    PublicCertificateVerificationResponse:'),
    );
    for (const field of [
      'certificateNumber',
      'status',
      'recipientDisplayName',
      'courseTitle',
      'organizationName',
      'issuedAt',
      'revokedAt',
      'safeRevocationReasonCode',
    ]) {
      expect(publicSchema).toContain(`${field}:`);
    }
    expect(publicSchema).not.toContain('level:');
    expect(publicSchema).not.toContain('certificateId:');
    expect(publicSchema).not.toContain('verificationTokenHash:');
    expect(contract).toContain('COMPLETION_EVIDENCE_CONFLICT');
    expect(contract).toContain('certificate_eligibility.privileged_viewed');
  });

  it('documents step-up ADMIN authorization and action-specific permissions accurately', async () => {
    const contract = await readFile(contractPath, 'utf8');
    const stepUpContract = contract.slice(
      contract.indexOf('  /auth/step-up/challenges:'),
      contract.indexOf('  /me/certificates/{certificateId}:'),
    );

    expect(stepUpContract.match(/x-required-roles: \[ADMIN\]/g)).toHaveLength(2);
    expect(stepUpContract.match(/CERTIFICATE_ISSUE: \[certificates\.issue\]/g)).toHaveLength(2);
    expect(stepUpContract.match(/CERTIFICATE_REVOKE: \[certificates\.revoke\]/g)).toHaveLength(2);
    expect(contract).toContain('code: ACCESS_DENIED');
    expect(contract).toContain('code: STEP_UP_VERIFICATION_FAILED');
  });

  it('documents both permission and teacher ownership failures for management reads', async () => {
    const contract = await readFile(contractPath, 'utf8');
    const courseScopeResponse = contract.slice(contract.indexOf('    CourseScopeDenied:'));

    expect(courseScopeResponse).toContain('code: ACCESS_DENIED');
    expect(courseScopeResponse).toContain('code: COURSE_SCOPE_DENIED');
  });
});
