import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityEvaluatorType,
  CertificateEligibilityPolicyCode,
  CertificateEligibilityStatus,
} from '@prisma/client';
import { completionEvidenceConflict } from './certificate-eligibility.errors.js';
import type {
  CertificateEligibilityCompletionTransaction,
  CourseCompletionEvidence,
} from './certificate-eligibility.types.js';

export class CertificateEligibilityCompletionEvaluator {
  async evaluate(
    transaction: CertificateEligibilityCompletionTransaction,
    evidence: CourseCompletionEvidence,
  ): Promise<string> {
    if (
      evidence.completedLessons <= 0 ||
      evidence.completedLessons !== evidence.totalEligibleLessons ||
      evidence.coursePercentage !== 100 ||
      evidence.completionCurriculumVersion <= 0 ||
      evidence.completionVersion <= 0
    ) {
      throw completionEvidenceConflict();
    }

    if (!(await transaction.hasCanonicalCompletionAuthority(evidence))) {
      throw completionEvidenceConflict();
    }

    const policy = await transaction.findV1EligibilityPolicy();
    if (
      !policy ||
      policy.code !== CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY ||
      policy.version !== 1 ||
      policy.assessmentRule !== CertificateEligibilityAssessmentRule.NONE ||
      policy.requiresAttendance ||
      policy.requiresManualApproval
    ) {
      throw completionEvidenceConflict();
    }

    const matchingEvents = await transaction.countCanonicalCompletionEvents(evidence);
    if (matchingEvents !== 1) throw completionEvidenceConflict();

    const existing = await transaction.findEligibilityEvaluationBySnapshot(
      evidence.enrollmentId,
      policy.id,
      evidence.completionVersion,
    );
    if (existing) {
      if (
        existing.courseId !== evidence.courseId ||
        existing.status !== CertificateEligibilityStatus.ELIGIBLE ||
        existing.completedAt.getTime() !== evidence.completedAt.getTime() ||
        existing.completionCurriculumVersion !== evidence.completionCurriculumVersion ||
        existing.completionVersion !== evidence.completionVersion ||
        existing.completedLessons !== evidence.completedLessons ||
        existing.totalEligibleLessons !== evidence.totalEligibleLessons ||
        existing.coursePercentage !== evidence.coursePercentage ||
        existing.evaluatorType !== CertificateEligibilityEvaluatorType.SYSTEM ||
        existing.evaluatedByUserId !== null
      ) {
        throw completionEvidenceConflict();
      }
      return existing.id;
    }

    const evaluatedAt = await transaction.getDatabaseTimestamp();
    const evaluationVersion = await transaction.getNextEligibilityEvaluationVersion(
      evidence.enrollmentId,
    );
    const evaluation = await transaction.createEligibilityEvaluation({
      enrollmentId: evidence.enrollmentId,
      courseId: evidence.courseId,
      policyId: policy.id,
      evaluationVersion,
      evaluatedAt,
      completedAt: evidence.completedAt,
      completionCurriculumVersion: evidence.completionCurriculumVersion,
      completionVersion: evidence.completionVersion,
      completedLessons: evidence.completedLessons,
      totalEligibleLessons: evidence.totalEligibleLessons,
      coursePercentage: evidence.coursePercentage,
    });
    return evaluation.id;
  }
}
