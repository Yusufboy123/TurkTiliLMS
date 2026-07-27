import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const contractPath = fileURLToPath(
  new URL('../../../docs/openapi/progress-tracking.v1.yaml', import.meta.url),
);

describe('Progress Tracking OpenAPI implementation markers', () => {
  it('marks exactly the nine student operations implemented and keeps reporting unavailable', async () => {
    const contract = await readFile(contractPath, 'utf8');
    expect(contract.match(/x-implementation-status: implemented/g)).toHaveLength(9);
    expect(contract.match(/x-implementation-status: future-boundary-not-available/g)).toHaveLength(
      4,
    );
    expect(contract).toContain('version: 1.0.0');
    expect(contract).not.toContain('version: 1.0.0-contract-candidate');
  });

  it('retains the approved idempotency, version, and stable error contracts', async () => {
    const contract = await readFile(contractPath, 'utf8');
    for (const operationId of [
      'getOwnProgressSummary',
      'listOwnCompletedCourses',
      'getOwnEnrollmentProgress',
      'getOwnEnrollmentResumeTarget',
      'completeOwnContentBlock',
      'reopenOwnContentBlock',
      'completeOwnLesson',
      'reopenOwnLesson',
      'recordOwnLastVisitedLesson',
    ]) {
      expect(contract).toContain(`operationId: ${operationId}`);
    }
    for (const errorCode of [
      'CURRICULUM_VERSION_CONFLICT',
      'COMPLETION_VERSION_CONFLICT',
      'IDEMPOTENCY_KEY_CONFLICT',
      'ENROLLMENT_CANCELLED',
      'ENROLLMENT_COMPLETED',
    ]) {
      expect(contract).toContain(`- ${errorCode}`);
    }
    expect(contract).toContain('name: Idempotency-Key');
    expect(contract).toContain('expectedCompletionVersion');
    expect(contract).toContain('curriculumVersion');
  });
});
