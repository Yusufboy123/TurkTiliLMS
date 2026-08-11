import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { StudentProfileInput, StudentProfileRecord } from './student-profile.types.js';

const profileSelect = {
  userId: true,
  currentLevel: true,
  learningGoal: true,
  ageRange: true,
  gender: true,
  weeklyStudyBand: true,
  preferredSkillFocus: true,
  onboardingCompletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentProfileSelect;

type ProfilePayload = Prisma.StudentProfileGetPayload<{ select: typeof profileSelect }>;

function mapProfile(profile: ProfilePayload): StudentProfileRecord {
  return profile;
}

export interface StudentProfileRepository {
  findByUserId(userId: string): Promise<StudentProfileRecord | null>;
  upsert(
    userId: string,
    input: StudentProfileInput & { onboardingCompletedAt: Date },
  ): Promise<StudentProfileRecord>;
}

export class PrismaStudentProfileRepository implements StudentProfileRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findByUserId(userId: string) {
    const profile = await this.client.studentProfile.findUnique({
      where: { userId },
      select: profileSelect,
    });
    return profile ? mapProfile(profile) : null;
  }

  async upsert(userId: string, input: StudentProfileInput & { onboardingCompletedAt: Date }) {
    const profile = await this.client.studentProfile.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
      select: profileSelect,
    });
    return mapProfile(profile);
  }
}
