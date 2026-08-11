import {
  RoleCode,
  StudentLearningGoal,
  StudentOnboardingLevel,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { StudentProfileService } from '../../src/modules/student-profile/student-profile.service.js';
import type { StudentProfileRepository } from '../../src/modules/student-profile/student-profile.repository.js';
import type {
  StudentProfileInput,
  StudentProfileRecord,
} from '../../src/modules/student-profile/student-profile.types.js';

const studentId = '019b9e22-e356-713e-be3a-ab43b5b43f8b';
const otherId = '019b9e22-e356-713e-be3a-ab43b43f8c';

function profile(input: Partial<StudentProfileRecord> = {}): StudentProfileRecord {
  return {
    userId: studentId,
    currentLevel: StudentOnboardingLevel.UNKNOWN,
    learningGoal: StudentLearningGoal.WORK,
    ageRange: null,
    gender: null,
    weeklyStudyBand: null,
    preferredSkillFocus: null,
    onboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
}

class FakeStudentProfileRepository implements StudentProfileRepository {
  value: StudentProfileRecord | null = null;
  async findByUserId(userId: string) {
    return this.value?.userId === userId ? this.value : null;
  }
  async upsert(userId: string, input: StudentProfileInput & { onboardingCompletedAt: Date }) {
    this.value = profile({ userId, ...input });
    return this.value;
  }
}

describe('StudentProfileService', () => {
  it('returns an empty profile for a student before onboarding', async () => {
    const service = new StudentProfileService(new FakeStudentProfileRepository());
    await expect(service.get({ userId: studentId, roles: [RoleCode.STUDENT] })).resolves.toBeNull();
  });

  it('creates and updates the owner profile idempotently', async () => {
    const repository = new FakeStudentProfileRepository();
    const service = new StudentProfileService(repository);
    const actor = { userId: studentId, roles: [RoleCode.STUDENT] };
    const input = {
      currentLevel: StudentOnboardingLevel.A1,
      learningGoal: StudentLearningGoal.STUDY,
    } as const;
    const created = await service.update(input, actor);
    const completedAt = created.onboardingCompletedAt;
    const updated = await service.update({ ...input, currentLevel: StudentOnboardingLevel.B1 }, actor);
    expect(updated.currentLevel).toBe(StudentOnboardingLevel.B1);
    expect(updated.onboardingCompletedAt).toEqual(completedAt);
  });

  it('rejects non-student access and never reads another user profile', async () => {
    const repository = new FakeStudentProfileRepository();
    repository.value = profile({ userId: otherId });
    const service = new StudentProfileService(repository);
    await expect(service.get({ userId: otherId, roles: [RoleCode.TEACHER] })).rejects.toMatchObject({
      code: 'ACCESS_DENIED',
      statusCode: 403,
    });
    await expect(service.get({ userId: studentId, roles: [RoleCode.STUDENT] })).resolves.toBeNull();
  });
});
