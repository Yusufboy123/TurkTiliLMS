import { RoleCode } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireAuthentication, requirePermission, requireRole } from '../authorization/authorization.middleware.js';
import { lessonLearningController } from './lesson-learning.container.js';
import type { LessonLearningController } from './lesson-learning.controller.js';

interface LessonLearningRouteDependencies {
  controller: LessonLearningController;
  authentication: RequestHandler;
  managementRole: RequestHandler;
  studentRole: RequestHandler;
  permission: (...permissions: string[]) => RequestHandler;
}

export function createLessonLearningRouter(dependencies: LessonLearningRouteDependencies): Router {
  const router = Router();
  const management = [dependencies.authentication, dependencies.managementRole] as const;
  const student = [dependencies.authentication, dependencies.studentRole] as const;

  router.get('/courses/:courseId/lessons/:lessonId/vocabulary', ...management, dependencies.permission('lessons.read'), asyncHandler(dependencies.controller.listVocabulary));
  router.post('/courses/:courseId/lessons/:lessonId/vocabulary', ...management, dependencies.permission('lessons.update'), asyncHandler(dependencies.controller.createVocabulary));
  router.patch('/courses/:courseId/lessons/:lessonId/vocabulary/:vocabularyId', ...management, dependencies.permission('lessons.update'), asyncHandler(dependencies.controller.updateVocabulary));
  router.delete('/courses/:courseId/lessons/:lessonId/vocabulary/:vocabularyId', ...management, dependencies.permission('lessons.update'), asyncHandler(dependencies.controller.deleteVocabulary));

  router.get('/courses/:courseId/lessons/:lessonId/quiz/questions', ...management, dependencies.permission('lessons.read'), asyncHandler(dependencies.controller.listQuestions));
  router.post('/courses/:courseId/lessons/:lessonId/quiz/questions', ...management, dependencies.permission('lessons.update'), asyncHandler(dependencies.controller.createQuestion));
  router.patch('/courses/:courseId/lessons/:lessonId/quiz/questions/:questionId', ...management, dependencies.permission('lessons.update'), asyncHandler(dependencies.controller.updateQuestion));
  router.delete('/courses/:courseId/lessons/:lessonId/quiz/questions/:questionId', ...management, dependencies.permission('lessons.update'), asyncHandler(dependencies.controller.deleteQuestion));
  router.get('/courses/:courseId/lessons/:lessonId/quiz/results', ...management, dependencies.permission('progress.course.read'), asyncHandler(dependencies.controller.teacherResults));

  router.get('/enrollments/:enrollmentId/lessons/:lessonId/vocabulary', ...student, dependencies.permission('progress.self_read'), asyncHandler(dependencies.controller.studentVocabulary));
  router.get('/enrollments/:enrollmentId/lessons/:lessonId/quiz', ...student, dependencies.permission('progress.self_read'), asyncHandler(dependencies.controller.studentQuiz));
  router.post('/enrollments/:enrollmentId/lessons/:lessonId/quiz/attempts', ...student, dependencies.permission('progress.self_complete'), asyncHandler(dependencies.controller.startAttempt));
  router.post('/enrollments/:enrollmentId/lessons/:lessonId/quiz/attempts/:attemptId/submit', ...student, dependencies.permission('progress.self_complete'), asyncHandler(dependencies.controller.submitAttempt));
  router.get('/enrollments/:enrollmentId/lessons/:lessonId/quiz/results/latest', ...student, dependencies.permission('progress.self_read'), asyncHandler(dependencies.controller.latestResult));
  router.post('/enrollments/:enrollmentId/lessons/:lessonId/practice/:practiceId/answer', ...student, dependencies.permission('progress.self_complete'), asyncHandler(dependencies.controller.submitPractice));
  return router;
}

export const lessonLearningRouter = createLessonLearningRouter({
  controller: lessonLearningController,
  authentication: requireAuthentication,
  managementRole: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
  studentRole: requireRole(RoleCode.STUDENT),
  permission: requirePermission,
});
