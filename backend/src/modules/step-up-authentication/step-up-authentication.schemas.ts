import { StepUpAction, StepUpContinuation, StepUpTargetType } from '@prisma/client';
import { z } from 'zod';

const uuidSchema = z.uuid('UUID formati noto\u2018g\u2018ri.');

export const createStepUpChallengeSchema = z
  .object({
    action: z.nativeEnum(StepUpAction),
    targetType: z.nativeEnum(StepUpTargetType),
    targetId: uuidSchema,
    continuation: z.nativeEnum(StepUpContinuation),
  })
  .strict()
  .superRefine((input, context) => {
    const isIssue =
      input.action === StepUpAction.CERTIFICATE_ISSUE &&
      input.targetType === StepUpTargetType.ENROLLMENT &&
      input.continuation === StepUpContinuation.CERTIFICATE_ISSUE_CONFIRMATION;
    const isRevoke =
      input.action === StepUpAction.CERTIFICATE_REVOKE &&
      input.targetType === StepUpTargetType.CERTIFICATE &&
      input.continuation === StepUpContinuation.CERTIFICATE_REVOKE_CONFIRMATION;

    if (!isIssue && !isRevoke) {
      context.addIssue({
        code: 'custom',
        path: ['action'],
        message: 'Amal, obyekt turi va davom ettirish turi o\u2018zaro mos emas.',
      });
    }
  });

export const stepUpChallengeParamsSchema = z.object({
  challengeId: uuidSchema,
});

export const verifyStepUpChallengeSchema = z
  .object({
    password: z.string().min(1, 'Parol kiritilishi shart.').max(1024).optional(),
    confirmRecentAuthentication: z.literal(true).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const supplied =
      Number(input.password !== undefined) + Number(input.confirmRecentAuthentication === true);
    if (supplied !== 1) {
      context.addIssue({
        code: 'custom',
        message:
          'Parol yoki yaqinda tasdiqlangan autentifikatsiya belgisi bittadan berilishi kerak.',
      });
    }
  });

export const rawStepUpProofSchema = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]{43}$/u);

export type CreateStepUpChallengeInput = z.infer<typeof createStepUpChallengeSchema>;
export type VerifyStepUpChallengeInput = z.infer<typeof verifyStepUpChallengeSchema>;
