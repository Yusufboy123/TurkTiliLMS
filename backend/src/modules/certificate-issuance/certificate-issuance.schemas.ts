import { CertificateRevocationReasonCode } from '@prisma/client';
import { z } from 'zod';

const uuid = z.uuid();

export const certificateIdParamsSchema = z.object({ certificateId: uuid }).strict();

export const courseCertificateParamsSchema = z
  .object({ courseId: uuid, certificateId: uuid })
  .strict();

export const issueCertificateParamsSchema = z.object({ enrollmentId: uuid }).strict();

export const verificationIdentifierParamsSchema = z
  .object({ verificationToken: z.string() })
  .strict();

export const verificationIdentifierSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

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
export const revocationIdempotencyKeySchema = z.string().trim().min(16).max(128);
export const stepUpProofSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

export const revokeCertificateBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    reasonCode: z.nativeEnum(CertificateRevocationReasonCode),
    reasonNote: z.string().trim().min(10).max(500).optional(),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.reasonCode === CertificateRevocationReasonCode.OTHER &&
      value.reasonNote === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reasonNote'],
        message: 'Boshqa sabab tanlanganda izoh kiritilishi shart.',
      });
    }
  });
