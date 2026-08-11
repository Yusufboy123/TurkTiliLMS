export type StudentOnboardingLevel = 'UNKNOWN' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type StudentLearningGoal =
  | 'WORK'
  | 'STUDY'
  | 'EXAM'
  | 'TRAVEL'
  | 'DAILY_COMMUNICATION'
  | 'PERSONAL_DEVELOPMENT'
  | 'OTHER';
export type StudentAgeRange = 'AGE_13_17' | 'AGE_18_24' | 'AGE_25_34' | 'AGE_35_44' | 'AGE_45_PLUS';
export type StudentGender = 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
export type StudentWeeklyStudyBand = 'HOURS_1_2' | 'HOURS_3_5' | 'HOURS_5_PLUS';
export type StudentSkillFocus = 'SPEAKING' | 'LISTENING' | 'READING' | 'WRITING' | 'ALL';

export interface StudentProfile {
  userId: string;
  currentLevel: StudentOnboardingLevel;
  learningGoal: StudentLearningGoal;
  ageRange: StudentAgeRange | null;
  gender: StudentGender | null;
  weeklyStudyBand: StudentWeeklyStudyBand | null;
  preferredSkillFocus: StudentSkillFocus | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StudentProfileInput = Omit<
  StudentProfile,
  'userId' | 'onboardingCompletedAt' | 'createdAt' | 'updatedAt'
>;
