import { StudentLearningGoal, StudentOnboardingLevel } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { updateStudentProfileSchema } from '../../src/modules/student-profile/student-profile.schemas.js';

describe('student profile validation', () => {
  it('requires current level and learning goal', () => {
    expect(() => updateStudentProfileSchema.parse({})).toThrow();
    expect(
      updateStudentProfileSchema.parse({
        currentLevel: StudentOnboardingLevel.UNKNOWN,
        learningGoal: StudentLearningGoal.OTHER,
      }),
    ).toMatchObject({ currentLevel: StudentOnboardingLevel.UNKNOWN });
  });
});
