import type {
  StudentAgeRange,
  StudentGender,
  StudentLearningGoal,
  StudentOnboardingLevel,
  StudentSkillFocus,
  StudentWeeklyStudyBand,
} from '@prisma/client';

export interface StudentProfileActor {
  userId: string;
  roles: string[];
}

export interface StudentProfileInput {
  currentLevel: StudentOnboardingLevel;
  learningGoal: StudentLearningGoal;
  ageRange?: StudentAgeRange | null;
  gender?: StudentGender | null;
  weeklyStudyBand?: StudentWeeklyStudyBand | null;
  preferredSkillFocus?: StudentSkillFocus | null;
}

export interface StudentProfileRecord extends StudentProfileInput {
  userId: string;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
