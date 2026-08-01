import type {
  AdminDashboardAggregateRow,
  AdminDashboardSummaryDto,
} from './admin-dashboard.types.js';

function count(value: bigint): number {
  return Number(value);
}

export function presentAdminDashboardSummary(
  aggregate: AdminDashboardAggregateRow,
): AdminDashboardSummaryDto {
  return {
    generatedAt: aggregate.generatedAt.toISOString(),
    users: {
      total: count(aggregate.usersTotal),
      active: count(aggregate.usersActive),
      suspended: count(aggregate.usersSuspended),
      deactivated: count(aggregate.usersDeactivated),
      deleted: count(aggregate.usersDeleted),
      students: count(aggregate.usersStudents),
      teachers: count(aggregate.usersTeachers),
      administrators: count(aggregate.usersAdministrators),
    },
    courses: {
      total: count(aggregate.coursesTotal),
      draft: count(aggregate.coursesDraft),
      inReview: count(aggregate.coursesInReview),
      published: count(aggregate.coursesPublished),
      archived: count(aggregate.coursesArchived),
      deleted: count(aggregate.coursesDeleted),
    },
    enrollments: {
      total: count(aggregate.enrollmentsTotal),
      active: count(aggregate.enrollmentsActive),
      suspended: count(aggregate.enrollmentsSuspended),
      completed: count(aggregate.enrollmentsCompleted),
      cancelled: count(aggregate.enrollmentsCancelled),
    },
    progress: {
      trackedEnrollments: count(aggregate.progressTrackedEnrollments),
      averageCompletionPercentage: count(aggregate.progressAverageCompletionPercentage),
    },
    certificates: {
      total: count(aggregate.certificatesTotal),
      issued: count(aggregate.certificatesIssued),
      revoked: count(aggregate.certificatesRevoked),
    },
  };
}
