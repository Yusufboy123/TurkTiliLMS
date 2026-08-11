import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { UpdateStudentProfileInput } from './student-profile.schemas.js';
import type { StudentProfileRepository } from './student-profile.repository.js';
import type {
  StudentProfileActor,
  StudentProfileInput,
  StudentProfileRecord,
} from './student-profile.types.js';

function assertStudent(actor: StudentProfileActor): void {
  if (!actor.roles.includes(RoleCode.STUDENT)) {
    throw new AppError('Bu amal faqat talabalar uchun.', 403, 'ACCESS_DENIED');
  }
}

export class StudentProfileService {
  constructor(private readonly repository: StudentProfileRepository) {}

  async get(actor: StudentProfileActor): Promise<StudentProfileRecord | null> {
    assertStudent(actor);
    return this.repository.findByUserId(actor.userId);
  }

  async update(
    input: UpdateStudentProfileInput,
    actor: StudentProfileActor,
  ): Promise<StudentProfileRecord> {
    assertStudent(actor);
    const existing = await this.repository.findByUserId(actor.userId);
    const profileInput: StudentProfileInput = {
      currentLevel: input.currentLevel,
      learningGoal: input.learningGoal,
      ageRange: input.ageRange ?? null,
      gender: input.gender ?? null,
      weeklyStudyBand: input.weeklyStudyBand ?? null,
      preferredSkillFocus: input.preferredSkillFocus ?? null,
    };
    return this.repository.upsert(actor.userId, {
      ...profileInput,
      onboardingCompletedAt: existing?.onboardingCompletedAt ?? new Date(),
    });
  }
}
