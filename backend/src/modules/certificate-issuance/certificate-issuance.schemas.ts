import { z } from 'zod';

const uuid = z.uuid();

export const certificateIdParamsSchema = z.object({ certificateId: uuid }).strict();

export const courseCertificateParamsSchema = z
  .object({ courseId: uuid, certificateId: uuid })
  .strict();

export const issueCertificateParamsSchema = z.object({ enrollmentId: uuid }).strict();

export const issueCertificateBodySchema = z
  .object({
    eligibilityEvaluationId: uuid,
    eligibilityEvaluationVersion: z.number().int().min(1),
    completionVersion: z.number().int().min(1),
    curriculumVersion: z.number().int().min(1),
    confirmed: z.literal(true),
  })
  .strict();

export const idempotencyKeySchema = z.string().trim().min(1).max(128);
export const stepUpProofSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
