import type {
  CompletedCoursePage,
  CourseProgress,
  ProgressMutationResult,
  StudentProgressSummary,
} from '../src/features/progress/types/progress.types';

const capabilities = {
  canReadProgress: true,
  canAccessCourseContent: true,
  canNavigateCurriculum: true,
  canDownloadPermittedMedia: true,
  canRecordActivity: true,
  canResumeLearning: true,
  canCompleteBlock: true,
  canReopenBlock: false,
  canCompleteLesson: false,
  canReopenLesson: false,
  unavailableReason: null,
} as const;

export const courseProgressFixture: CourseProgress = {
  enrollmentId: '019c0000-0000-7000-8000-000000000001',
  course: {
    id: '019c0000-0000-7000-8000-000000000002',
    title: 'Turk tili A1',
    slug: 'turk-tili-a1',
  },
  enrollmentStatus: 'ACTIVE',
  status: 'IN_PROGRESS',
  curriculumVersion: 3,
  completionVersion: 4,
  activityVersion: 7,
  completedLessons: 0,
  totalEligibleLessons: 1,
  percentage: 0,
  firstActivityAt: '2026-07-26T08:00:00.000Z',
  lastActivityAt: '2026-07-26T09:00:00.000Z',
  completedAt: null,
  resumeTarget: {
    enrollmentId: '019c0000-0000-7000-8000-000000000001',
    course: {
      id: '019c0000-0000-7000-8000-000000000002',
      title: 'Turk tili A1',
      slug: 'turk-tili-a1',
    },
    section: {
      id: '019c0000-0000-7000-8000-000000000003',
      title: 'Kirish',
      position: 1,
    },
    lesson: {
      id: '019c0000-0000-7000-8000-000000000004',
      title: 'Salomlashish',
      slug: 'salomlashish',
      position: 1,
    },
    lastActivityAt: '2026-07-26T09:00:00.000Z',
    coursePercentage: 0,
    unavailableReason: null,
  },
  capabilities,
  completedEligibleBlocks: 0,
  totalEligibleBlocks: 1,
  sections: [
    {
      id: '019c0000-0000-7000-8000-000000000003',
      title: 'Kirish',
      position: 1,
      status: 'IN_PROGRESS',
      completedLessons: 0,
      totalEligibleLessons: 1,
      percentage: 0,
      lessons: [
        {
          id: '019c0000-0000-7000-8000-000000000004',
          sectionId: '019c0000-0000-7000-8000-000000000003',
          title: 'Salomlashish',
          slug: 'salomlashish',
          position: 1,
          status: 'IN_PROGRESS',
          completedEligibleBlocks: 0,
          totalEligibleBlocks: 1,
          percentage: 0,
          firstActivityAt: '2026-07-26T08:00:00.000Z',
          lastActivityAt: '2026-07-26T09:00:00.000Z',
          completedAt: null,
          blocks: [
            {
              id: '019c0000-0000-7000-8000-000000000005',
              blockType: 'VIDEO',
              title: 'Salomlashish videosi',
              position: 1,
              isRequired: true,
              status: 'INCOMPLETE',
              completedAt: null,
              capabilities: {
                canCompleteBlock: true,
                canReopenBlock: false,
                unavailableReason: null,
              },
            },
          ],
          capabilities: {
            canCompleteLesson: false,
            canReopenLesson: false,
            unavailableReason: null,
          },
        },
      ],
    },
  ],
  calculatedAt: '2026-07-26T09:00:00.000Z',
};

export const progressSummaryFixture: StudentProgressSummary = {
  generatedAt: '2026-07-26T09:00:00.000Z',
  resumeLearning: courseProgressFixture.resumeTarget,
  activeCourseCount: 1,
  completedCourseCount: 0,
  activeCourses: [courseProgressFixture],
};

export const completedCoursesFixture: CompletedCoursePage = {
  items: [
    {
      enrollmentId: '019c0000-0000-7000-8000-000000000010',
      course: {
        id: '019c0000-0000-7000-8000-000000000011',
        title: 'Turk tili kirish kursi',
        slug: 'turk-tili-kirish-kursi',
      },
      completionCurriculumVersion: 2,
      percentage: 100,
      completedLessons: 4,
      totalEligibleLessons: 4,
      completedAt: '2026-07-20T12:00:00.000Z',
    },
  ],
  pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
};

export const progressMutationFixture: ProgressMutationResult = {
  enrollmentId: courseProgressFixture.enrollmentId,
  curriculumVersion: 3,
  completionVersion: 5,
  activityVersion: 7,
  changed: true,
  affectedLesson: {
    ...courseProgressFixture.sections[0].lessons[0],
    completedEligibleBlocks: 1,
    percentage: 100,
    status: 'READY_TO_COMPLETE',
    blocks: [
      {
        ...courseProgressFixture.sections[0].lessons[0].blocks[0],
        status: 'COMPLETED',
        completedAt: '2026-07-26T10:00:00.000Z',
        capabilities: {
          canCompleteBlock: false,
          canReopenBlock: true,
          unavailableReason: null,
        },
      },
    ],
    capabilities: {
      canCompleteLesson: true,
      canReopenLesson: false,
      unavailableReason: null,
    },
  },
  course: {
    ...courseProgressFixture,
    completionVersion: 5,
  },
  resumeTarget: courseProgressFixture.resumeTarget,
};
