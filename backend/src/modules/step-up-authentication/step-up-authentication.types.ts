import type { RoleCode, StepUpAction, StepUpContinuation, StepUpTargetType } from '@prisma/client';

export interface StepUpActor {
  userId: string;
  sessionId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface StepUpAuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface StepUpSecurityContext {
  userId: string;
  sessionId: string;
  passwordHash: string;
  credentialEpoch: Date;
  requiresPasswordChange: boolean;
  credentialLockedUntil: Date | null;
  lastAuthenticatedAt: Date | null;
  roles: RoleCode[];
  permissions: string[];
}

export interface StepUpChallengeRecord {
  id: string;
  userId: string;
  sessionId: string;
  credentialEpoch: Date;
  action: StepUpAction;
  targetType: StepUpTargetType;
  targetId: string;
  continuation: StepUpContinuation;
  continuationId: string;
  attemptCount: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  lockedAt: Date | null;
}

export interface StepUpProofRecord {
  id: string;
  challengeId: string;
  userId: string;
  sessionId: string;
  credentialEpoch: Date;
  action: StepUpAction;
  targetType: StepUpTargetType;
  targetId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  challenge: {
    verifiedAt: Date | null;
    lockedAt: Date | null;
    expiresAt: Date;
  };
}

export interface StepUpChallengeDto {
  id: string;
  action: StepUpAction;
  targetType: StepUpTargetType;
  targetId: string;
  verificationRequired: boolean;
  expiresAt: string;
  continuationId: string;
}

export interface StepUpProofDto {
  proof: string;
  expiresAt: string;
  action: StepUpAction;
  targetType: StepUpTargetType;
  targetId: string;
  continuationId: string;
}

export interface ConsumeStepUpProofInput {
  proof: string;
  action: StepUpAction;
  targetType: StepUpTargetType;
  targetId: string;
}

export interface ConsumedStepUpProof {
  proofId: string;
  challengeId: string;
  consumedAt: Date;
}
