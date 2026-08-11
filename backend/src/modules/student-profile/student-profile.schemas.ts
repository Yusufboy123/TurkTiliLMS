import {
  StudentAgeRange,
  StudentGender,
  StudentLearningGoal,
  StudentOnboardingLevel,
  StudentSkillFocus,
  StudentWeeklyStudyBand,
} from '@prisma/client';
import { z } from 'zod';

export const updateStudentProfileSchema = z
  .object({
    currentLevel: z.nativeEnum(StudentOnboardingLevel),
    learningGoal: z.nativeEnum(StudentLearningGoal),
    ageRange: z.nativeEnum(StudentAgeRange).nullable().optional(),
    gender: z.nativeEnum(StudentGender).nullable().optional(),
    weeklyStudyBand: z.nativeEnum(StudentWeeklyStudyBand).nullable().optional(),
    preferredSkillFocus: z.nativeEnum(StudentSkillFocus).nullable().optional(),
  })
  .strict();

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
