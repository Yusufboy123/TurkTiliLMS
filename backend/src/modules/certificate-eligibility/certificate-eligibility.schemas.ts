import { z } from 'zod';

const uuid = z.uuid('Identifikator noto\u2018g\u2018ri.');

export const eligibilityEnrollmentParamsSchema = z.object({ enrollmentId: uuid }).strict();

export const courseEligibilityParamsSchema = z
  .object({
    courseId: uuid,
    enrollmentId: uuid,
  })
  .strict();
