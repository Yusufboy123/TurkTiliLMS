export type EnrollmentStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'COMPLETED';
export type BlockProgressState = 'NOT_STARTED' | 'INCOMPLETE' | 'COMPLETED';
export type LessonProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_TO_COMPLETE' | 'COMPLETED';
export type CourseProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type LessonContentBlockType =
  'TEXT' | 'VIDEO' | 'AUDIO' | 'PDF' | 'DOCUMENT' | 'IMAGE' | 'LINK' | 'DOWNLOAD';
export type ProgressUnavailableReason =
  | 'ENROLLMENT_SUSPENDED'
  | 'ENROLLMENT_CANCELLED'
  | 'ENROLLMENT_COMPLETED'
  | 'COURSE_UNAVAILABLE'
  | 'LESSON_UNAVAILABLE'
  | 'CONTENT_BLOCK_UNAVAILABLE'
  | null;

export interface ProgressCapabilities {
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

export interface CourseReference {
  id: string;
  title: string;
  slug: string;
}

export interface ResumeLearning {
  enrollmentId: string;
  course: CourseReference;
  section: { id: string; title: string; position: number };
  lesson: { id: string; title: string; slug: string; position: number };
  lastActivityAt: string | null;
  coursePercentage: number;
  unavailableReason: ProgressUnavailableReason;
}

export interface BlockProgress {
  id: string;
  blockType: LessonContentBlockType;
  title: string | null;
  position: number;
  isRequired: boolean;
  status: BlockProgressState;
  completedAt: string | null;
  capabilities: {
    canCompleteBlock: boolean;
    canReopenBlock: boolean;
    unavailableReason: ProgressUnavailableReason;
  };
}

export interface LessonProgress {
  id: string;
  sectionId: string;
  title: string;
  slug: string;
  position: number;
  status: LessonProgressState;
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
  percentage: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  blocks: BlockProgress[];
  capabilities: {
    canCompleteLesson: boolean;
    canReopenLesson: boolean;
    unavailableReason: ProgressUnavailableReason;
  };
}

export interface SectionProgress {
  id: string;
  title: string;
  position: number;
  status: CourseProgressState;
  completedLessons: number;
  totalEligibleLessons: number;
  percentage: number;
  lessons: LessonProgress[];
}

export interface CourseProgressSummary {
  enrollmentId: string;
  course: CourseReference;
  enrollmentStatus: EnrollmentStatus;
  status: CourseProgressState;
  curriculumVersion: number;
  completionVersion: number;
  activityVersion: number;
  completedLessons: number;
  totalEligibleLessons: number;
  percentage: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  resumeTarget: ResumeLearning | null;
  capabilities: ProgressCapabilities;
}

export interface CourseProgress extends CourseProgressSummary {
  completedEligibleBlocks: number;
  totalEligibleBlocks: number;
  sections: SectionProgress[];
  calculatedAt: string;
}

export interface StudentProgressSummary {
  generatedAt: string;
  resumeLearning: ResumeLearning | null;
  activeCourseCount: number;
  completedCourseCount: number;
  activeCourses: CourseProgressSummary[];
}

export interface CompletedCourse {
  enrollmentId: string;
  course: CourseReference;
  completionCurriculumVersion: number;
  percentage: 100;
  completedLessons: number;
  totalEligibleLessons: number;
  completedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CompletedCoursePage {
  items: CompletedCourse[];
  pagination: Pagination;
}

export interface CompletionMutationInput {
  expectedCompletionVersion: number;
  curriculumVersion: number;
}

export interface LastVisitedMutationInput {
  lessonId: string;
  curriculumVersion: number;
}

export interface ProgressMutationResult {
  enrollmentId: string;
  curriculumVersion: number;
  completionVersion: number;
  activityVersion: number;
  changed: boolean;
  affectedLesson: LessonProgress;
  course: CourseProgressSummary;
  resumeTarget: ResumeLearning | null;
}

export interface ActivityMutationResult {
  enrollmentId: string;
  curriculumVersion: number;
  completionVersion: number;
  activityVersion: number;
  changed: boolean;
  lastVisitedLessonId: string;
  lastVisitedAt: string;
  resumeTarget: ResumeLearning | null;
}

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  code: string;
  message: string;
  details?: unknown;
}

export interface CompletedCourseQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'completedAt' | 'enrolledAt';
  sortDirection?: 'asc' | 'desc';
}
