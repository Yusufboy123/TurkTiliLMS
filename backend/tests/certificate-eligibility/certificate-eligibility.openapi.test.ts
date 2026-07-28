import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const contractPath = fileURLToPath(
  new URL(
    '../../../docs/openapi/course-completion-certificate-eligibility.v1.yaml',
    import.meta.url,
  ),
);

describe('Certificate eligibility OpenAPI runtime markers', () => {
  it('marks exactly the four Module 8.5C reads available', async () => {
    const contract = await readFile(contractPath, 'utf8');
    expect(contract.match(/x-implementation-status: implemented/g)).toHaveLength(4);
    expect(contract.match(/x-implementation-status: contract-only-not-available/g)).toHaveLength(9);
    for (const operationId of [
      'getOwnCertificateEligibility',
      'getOwnCertificateStatus',
      'getCourseEnrollmentCertificateEligibility',
      'getCourseEnrollmentCertificateStatus',
    ]) {
      expect(contract).toContain(`operationId: ${operationId}`);
    }
  });

  it('keeps issuance and revocation unavailable', async () => {
    const contract = await readFile(contractPath, 'utf8');
    expect(contract).toContain('operationId: issueEnrollmentCertificate');
    expect(contract).toContain('operationId: revokeCertificate');
    expect(contract).toContain('COMPLETION_EVIDENCE_CONFLICT');
    expect(contract).toContain('certificate_eligibility.privileged_viewed');
  });

  it('documents both permission and teacher ownership failures for management reads', async () => {
    const contract = await readFile(contractPath, 'utf8');
    const courseScopeResponse = contract.slice(contract.indexOf('    CourseScopeDenied:'));

    expect(courseScopeResponse).toContain('code: ACCESS_DENIED');
    expect(courseScopeResponse).toContain('code: COURSE_SCOPE_DENIED');
  });
});
