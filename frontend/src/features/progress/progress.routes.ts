export const progressRouteSegments = {
  overview: 'progress',
  completed: 'progress/completed',
  course: 'progress/:enrollmentId',
  resume: 'progress/:enrollmentId/resume',
} as const;

export const progressPaths = {
  dashboard: '/app',
  overview: '/app/progress',
  completed: '/app/progress/completed',
  course: (enrollmentId: string) => `/app/progress/${enrollmentId}`,
  resume: (enrollmentId: string) => `/app/progress/${enrollmentId}/resume`,
  lesson: (enrollmentId: string, lessonId: string) => `/learn/${enrollmentId}/lessons/${lessonId}`,
  lessonPattern: '/learn/:enrollmentId/lessons/:lessonId',
} as const;
