import type { RoleCode } from '@prisma/client';

export const adminDashboardRequiredPermissions = [
  'users.read',
  'courses.view_statistics',
  'progress.read',
  'certificates.course_read',
] as const;

export interface AdminDashboardActor {
  readonly userId: string;
  readonly roles: readonly RoleCode[];
  readonly permissions: readonly string[];
}

export interface AdminDashboardAuditContext {
  readonly actorUserId: string;
  readonly requestCorrelationId?: string | undefined;
  readonly ipHash: string;
  readonly userAgentSummary?: string | undefined;
}

export interface AdminDashboardAggregateRow {
  readonly generatedAt: Date;
  readonly usersTotal: bigint;
  readonly usersActive: bigint;
  readonly usersSuspended: bigint;
  readonly usersDeactivated: bigint;
  readonly usersDeleted: bigint;
  readonly usersLifecycleMismatch: bigint;
  readonly usersStudents: bigint;
  readonly usersTeachers: bigint;
  readonly usersAdministrators: bigint;
  readonly coursesTotal: bigint;
  readonly coursesDraft: bigint;
  readonly coursesInReview: bigint;
  readonly coursesPublished: bigint;
  readonly coursesArchived: bigint;
  readonly coursesDeleted: bigint;
  readonly enrollmentsTotal: bigint;
  readonly enrollmentsActive: bigint;
  readonly enrollmentsSuspended: bigint;
  readonly enrollmentsCompleted: bigint;
  readonly enrollmentsCancelled: bigint;
  readonly progressTrackedEnrollments: bigint;
  readonly invalidProgressCount: bigint;
  readonly progressAverageCompletionPercentage: bigint;
  readonly certificatesTotal: bigint;
  readonly certificatesIssued: bigint;
  readonly certificatesRevoked: bigint;
}

export interface AdminDashboardSummaryDto {
  readonly generatedAt: string;
  readonly users: {
    readonly total: number;
    readonly active: number;
    readonly suspended: number;
    readonly deactivated: number;
    readonly deleted: number;
    readonly students: number;
    readonly teachers: number;
    readonly administrators: number;
  };
  readonly courses: {
    readonly total: number;
    readonly draft: number;
    readonly inReview: number;
    readonly published: number;
    readonly archived: number;
    readonly deleted: number;
  };
  readonly enrollments: {
    readonly total: number;
    readonly active: number;
    readonly suspended: number;
    readonly completed: number;
    readonly cancelled: number;
  };
  readonly progress: {
    readonly trackedEnrollments: number;
    readonly averageCompletionPercentage: number;
  };
  readonly certificates: {
    readonly total: number;
    readonly issued: number;
    readonly revoked: number;
  };
}

export interface AdminDashboardRateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAfterSeconds: number;
}
