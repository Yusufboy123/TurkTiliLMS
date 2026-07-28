import type {
  BlockProgressState,
  CourseEnrollmentStatus,
  CourseStatus,
  IdempotencyOperation,
  LessonContentBlockType,
  LessonProgressState as PersistedLessonProgressState,
  ProgressEventState,
  ProgressEventType,
  RoleCode,
} from '@prisma/client';

export type ProgressUnavailableReason =
  | 'ENROLLMENT_SUSPENDED'
  | 'ENROLLMENT_CANCELLED'
  | 'ENROLLMENT_COMPLETED'
  | 'COURSE_UNAVAILABLE'
  | 'LESSON_UNAVAILABLE'
  | 'CONTENT_BLOCK_UNAVAILABLE'
  | null;

export type ProjectedBlockProgressState = 'NOT_STARTED' | BlockProgressState;
export type ProjectedLessonProgressState =
  'NOT_STARTED' | 'IN_PROGRESS' | 'READY_TO_COMPLETE' | 'COMPLETED';
export type ProjectedCourseProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProgressActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface ProgressRequestContext {
  idempotencyKey: string;
  requestCorrelationId?: string;
}

export interface CompletionMutationInput {
  expectedCompletionVersion: number;
  curriculumVersion: number;
}

export interface LastVisitedMutationInput {
  lessonId: string;
  curriculumVersion: number;
}

export interface ProgressRootRecord {
  id: string;
  enrollmentId: string;
  lastVisitedLessonId: string | null;
  lastVisitedAt: Date | null;
  firstActivityAt: Date | null;
  completionVersion: number;
  activityVersion: number;
  curriculumVersion: number;
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
  completedLessons: number;
  totalEligibleLessons: number;
  coursePercentage: number;
  frozenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressBlockRecord {
  id: string;
  blockType: LessonContentBlockType;
  title: string | null;
  position: number;
  isRequired: boolean;
  progress: {
    state: BlockProgressState;
    completedAt: Date | null;
  } | null;
}

export interface ProgressLessonRecord {
  id: string;
  sectionId: string;
  title: string;
  slug: string;
  position: number;
  progress: {
    state: PersistedLessonProgressState;
    firstActivityAt: Date;
    lastActivityAt: Date;
    completedAt: Date | null;
  } | null;
  blocks: ProgressBlockRecord[];
}

export interface ProgressSectionRecord {
  id: string;
  title: string;
  position: number;
  lessons: ProgressLessonRecord[];
}

export interface ProgressEnrollmentRecord {
  id: string;
  studentId: string;
  status: CourseEnrollmentStatus;
  enrolledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  suspendedAt: Date | null;
  course: {
    id: string;
    title: string;
    slug: string;
    status: CourseStatus;
    publishedAt: Date | null;
    deletedAt: Date | null;
    curriculumVersion: number;
    sections: ProgressSectionRecord[];
  };
  root: ProgressRootRecord | null;
}

export interface ProgressAggregate {
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
  completedLessons: number;
  totalEligibleLessons: number;
  coursePercentage: number;
}

export interface ProgressCapabilitiesDto {
  canReadProgress: boolean;
  canAccessCourseContent: boolean;
  canNavigateCurriculum: boolean;
  canDownloadPermittedMedia: boolean;
  canRecordActivity: boolean;
  canResumeLearning: boolean;
  canCompleteBlock: boolean;
  canReopenBlock: boolean;
  canCompleteLesson: boolean;
  canReopenLesson: boolean;
  unavailableReason: ProgressUnavailableReason;
}

export interface BlockProgressDto {
  id: string;
  blockType: LessonContentBlockType;
  title: string | null;
  position: number;
  isRequired: boolean;
  status: ProjectedBlockProgressState;
  completedAt: string | null;
  capabilities: {
    canCompleteBlock: boolean;
    canReopenBlock: boolean;
    unavailableReason: ProgressUnavailableReason;
  };
}

export interface LessonProgressDto {
  id: string;
  sectionId: string;
  title: string;
  slug: string;
  position: number;
  status: ProjectedLessonProgressState;
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
  percentage: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  blocks: BlockProgressDto[];
  capabilities: {
    canCompleteLesson: boolean;
    canReopenLesson: boolean;
    unavailableReason: ProgressUnavailableReason;
  };
}

export interface SectionProgressDto {
  id: string;
  title: string;
  position: number;
  status: ProjectedCourseProgressState;
  completedLessons: number;
  totalEligibleLessons: number;
  percentage: number;
  lessons: LessonProgressDto[];
}

export interface CourseReferenceDto {
  id: string;
  title: string;
  slug: string;
}

export interface ResumeLearningDto {
  enrollmentId: string;
  course: CourseReferenceDto;
  section: {
    id: string;
    title: string;
    position: number;
  };
  lesson: {
    id: string;
    title: string;
    slug: string;
    position: number;
  };
  lastActivityAt: string | null;
  coursePercentage: number;
  unavailableReason: ProgressUnavailableReason;
}

export interface CourseProgressSummaryDto {
  enrollmentId: string;
  course: CourseReferenceDto;
  enrollmentStatus: CourseEnrollmentStatus;
  status: ProjectedCourseProgressState;
  curriculumVersion: number;
  completionVersion: number;
  activityVersion: number;
  completedLessons: number;
  totalEligibleLessons: number;
  percentage: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  resumeTarget: ResumeLearningDto | null;
  capabilities: ProgressCapabilitiesDto;
}

export interface CourseProgressDto extends CourseProgressSummaryDto {
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
  sections: SectionProgressDto[];
  calculatedAt: string;
}

export interface StudentProgressSummaryDto {
  generatedAt: string;
  resumeLearning: ResumeLearningDto | null;
  activeCourseCount: number;
  completedCourseCount: number;
  activeCourses: CourseProgressSummaryDto[];
}

export interface CompletedCourseDto {
  enrollmentId: string;
  course: CourseReferenceDto;
  completionCurriculumVersion: number;
  percentage: 100;
  completedLessons: number;
  totalEligibleLessons: number;
  completedAt: string;
}

export interface PaginationDto {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CompletedCoursePageDto {
  items: CompletedCourseDto[];
  pagination: PaginationDto;
}

export interface ProgressMutationResultDto {
  enrollmentId: string;
  curriculumVersion: number;
  completionVersion: number;
  activityVersion: number;
  changed: boolean;
  affectedLesson: LessonProgressDto;
  course: CourseProgressSummaryDto;
  resumeTarget: ResumeLearningDto | null;
}

export interface ActivityMutationResultDto {
  enrollmentId: string;
  curriculumVersion: number;
  completionVersion: number;
  activityVersion: number;
  changed: boolean;
  lastVisitedLessonId: string;
  lastVisitedAt: string;
  resumeTarget: ResumeLearningDto | null;
}

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface MutationExecution<T> {
  envelope: SuccessEnvelope<T>;
  replayed: boolean;
}

export interface IdempotencyRecordData {
  id: string;
  actorUserId: string;
  enrollmentId: string;
  key: string;
  operation: IdempotencyOperation;
  requestFingerprint: string;
  responseStatus: number;
  responseEnvelope: unknown;
  resultingCompletionVersion: number | null;
  resultingActivityVersion: number | null;
  expiresAt: Date;
}

export interface ProgressEventData {
  enrollmentId: string;
  actorUserId: string;
  eventType: ProgressEventType;
  lessonId: string | null;
  blockId: string | null;
  previousState: ProgressEventState;
  newState: ProgressEventState;
  curriculumVersion: number;
  resultingCompletionVersion: number;
  idempotencyRecordId: string;
  occurredAt: Date;
  requestCorrelationId?: string;
  snapshot?: ProgressAggregate;
}

export interface CompletedCourseQuery {
  page: number;
  pageSize: number;
  sortBy: 'completedAt' | 'enrolledAt';
  sortDirection: 'asc' | 'desc';
}
