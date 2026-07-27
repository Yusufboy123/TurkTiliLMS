import { CourseEnrollmentStatus } from '@prisma/client';
import { presentCourseProgress } from '../progress-tracking/progress-tracking.presenter.js';
import type {
  CourseProgressDto,
  ProgressActor,
  ProgressRootRecord,
  ProjectedCourseProgressState,
} from '../progress-tracking/progress-tracking.types.js';
import type {
  ReportingCapabilitiesDto,
  ReportingEnrollmentRecord,
  TeacherStudentProgressDto,
  DetailedReportingEnrollment,
} from './progress-reporting.types.js';

export const reportingCapabilities: ReportingCapabilitiesDto = {
  canReadDetail: true,
  canExport: false,
  exportRequiresStepUp: true,
};

export function reportingProgressState(
  enrollment: Pick<ReportingEnrollmentRecord, 'status' | 'progressRoot'>,
): ProjectedCourseProgressState {
  if (enrollment.status === CourseEnrollmentStatus.COMPLETED) return 'COMPLETED';
  const root = enrollment.progressRoot;
  return root &&
    (root.firstActivityAt ||
      root.lastVisitedAt ||
      root.completedLessons > 0 ||
      root.coursePercentage > 0)
    ? 'IN_PROGRESS'
    : 'NOT_STARTED';
}

export function presentReportingEnrollment(
  enrollment: ReportingEnrollmentRecord,
): TeacherStudentProgressDto {
  const percentage =
    enrollment.status === CourseEnrollmentStatus.COMPLETED
      ? 100
      : (enrollment.progressRoot?.coursePercentage ?? 0);
  return {
    enrollmentId: enrollment.id,
    student: enrollment.student,
    enrollmentStatus: enrollment.status,
    progressStatus: reportingProgressState(enrollment),
    percentage,
    completedLessons: enrollment.progressRoot?.completedLessons ?? 0,
    totalEligibleLessons: enrollment.progressRoot?.totalEligibleLessons ?? 0,
    lastActivityAt: enrollment.progressRoot?.lastVisitedAt?.toISOString() ?? null,
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    capabilities: reportingCapabilities,
  };
}

function reportingRoot(record: DetailedReportingEnrollment): ProgressRootRecord {
  const { enrollment } = record;
  if (enrollment.root) return enrollment.root;
  const timestamp = enrollment.completedAt ?? enrollment.cancelledAt ?? enrollment.enrolledAt;
  return {
    id: enrollment.id,
    enrollmentId: enrollment.id,
    lastVisitedLessonId: null,
    lastVisitedAt: null,
    firstActivityAt: null,
    completionVersion: 0,
    activityVersion: 0,
    curriculumVersion: enrollment.course.curriculumVersion,
    completedEligibleBlocks: 0,
    totalEligibleBlocks: 0,
    completedLessons: 0,
    totalEligibleLessons: 0,
    coursePercentage: enrollment.status === CourseEnrollmentStatus.COMPLETED ? 100 : 0,
    frozenAt: timestamp,
    createdAt: enrollment.enrolledAt,
    updatedAt: timestamp,
  };
}

const reportingActor: ProgressActor = {
  userId: '',
  roles: [],
  permissions: [],
};

export function presentReportingDetail(
  record: DetailedReportingEnrollment,
  calculatedAt: Date,
): CourseProgressDto {
  const progress = presentCourseProgress(
    record.enrollment,
    reportingRoot(record),
    reportingActor,
    calculatedAt,
  );
  const unavailableReason = progress.capabilities.unavailableReason;
  return {
    ...progress,
    resumeTarget: null,
    capabilities: {
      canReadProgress: true,
      canAccessCourseContent: false,
      canNavigateCurriculum: false,
      canDownloadPermittedMedia: false,
      canRecordActivity: false,
      canResumeLearning: false,
      canCompleteBlock: false,
      canReopenBlock: false,
      canCompleteLesson: false,
      canReopenLesson: false,
      unavailableReason,
    },
    sections: progress.sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => ({
        ...lesson,
        capabilities: {
          canCompleteLesson: false,
          canReopenLesson: false,
          unavailableReason,
        },
        blocks: lesson.blocks.map((block) => ({
          ...block,
          capabilities: {
            canCompleteBlock: false,
            canReopenBlock: false,
            unavailableReason,
          },
        })),
      })),
    })),
  };
}
