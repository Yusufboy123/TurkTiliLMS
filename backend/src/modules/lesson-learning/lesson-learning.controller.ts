import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  attemptParamsSchema,
  createQuestionSchema,
  createVocabularySchema,
  learningParentParamsSchema,
  questionIdParamsSchema,
  studentQuizParamsSchema,
  submitQuizSchema,
  updateQuestionSchema,
  updateVocabularySchema,
  vocabularyIdParamsSchema,
} from './lesson-learning.schemas.js';
import type { LessonLearningService } from './lesson-learning.service.js';
import type { LearningActor } from './lesson-learning.types.js';

function principalFrom(request: Request): AuthenticatedPrincipal {
  const principal = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!principal) throw new AppError('Davom etish uchun tizimga kirish talab qilinadi.', 401, 'AUTHENTICATION_REQUIRED');
  return principal;
}

function actorFrom(principal: AuthenticatedPrincipal): LearningActor {
  return { userId: principal.userId, roles: principal.roles, permissions: principal.permissions };
}

export class LessonLearningController {
  constructor(private readonly service: LessonLearningService) {}

  listVocabulary = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId } = learningParentParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Lug‘at olindi.', data: await this.service.listVocabulary(courseId, lessonId, actorFrom(principal)) });
  };

  createVocabulary = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId } = learningParentParamsSchema.parse(request.params);
    const data = await this.service.createVocabulary(courseId, lessonId, createVocabularySchema.parse(request.body), actorFrom(principal));
    response.status(201).location(`/api/v1/courses/${courseId}/lessons/${lessonId}/vocabulary/${data.id}`).json({ success: true, message: 'Lug‘at yozuvi yaratildi.', data });
  };

  updateVocabulary = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId, vocabularyId } = vocabularyIdParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Lug‘at yozuvi yangilandi.', data: await this.service.updateVocabulary(courseId, lessonId, vocabularyId, updateVocabularySchema.parse(request.body), actorFrom(principal)) });
  };

  deleteVocabulary = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId, vocabularyId } = vocabularyIdParamsSchema.parse(request.params);
    await this.service.deleteVocabulary(courseId, lessonId, vocabularyId, actorFrom(principal));
    response.status(200).json({ success: true, message: 'Lug‘at yozuvi o‘chirildi.' });
  };

  listQuestions = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId } = learningParentParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Test savollari olindi.', data: await this.service.listQuestions(courseId, lessonId, actorFrom(principal)) });
  };

  createQuestion = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId } = learningParentParamsSchema.parse(request.params);
    const data = await this.service.createQuestion(courseId, lessonId, createQuestionSchema.parse(request.body), actorFrom(principal));
    response.status(201).location(`/api/v1/courses/${courseId}/lessons/${lessonId}/quiz/questions/${data.id}`).json({ success: true, message: 'Test savoli yaratildi.', data });
  };

  updateQuestion = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId, questionId } = questionIdParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Test savoli yangilandi.', data: await this.service.updateQuestion(courseId, lessonId, questionId, updateQuestionSchema.parse(request.body), actorFrom(principal)) });
  };

  deleteQuestion = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId, questionId } = questionIdParamsSchema.parse(request.params);
    await this.service.deleteQuestion(courseId, lessonId, questionId, actorFrom(principal));
    response.status(200).json({ success: true, message: 'Test savoli o‘chirildi.' });
  };

  studentVocabulary = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId } = studentQuizParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Dars lug‘ati olindi.', data: await this.service.studentVocabulary(enrollmentId, lessonId, actorFrom(principal)) });
  };

  studentQuiz = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId } = studentQuizParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Test olindi.', data: await this.service.studentQuiz(enrollmentId, lessonId, actorFrom(principal)) });
  };

  startAttempt = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId } = studentQuizParamsSchema.parse(request.params);
    const data = await this.service.startAttempt(enrollmentId, lessonId, actorFrom(principal));
    response.status(201).location(`/api/v1/enrollments/${enrollmentId}/lessons/${lessonId}/quiz/attempts/${data.id}`).json({ success: true, message: 'Test urinishi boshlandi.', data });
  };

  submitAttempt = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId, attemptId } = attemptParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Test javoblari qabul qilindi.', data: await this.service.submitAttempt(enrollmentId, lessonId, attemptId, submitQuizSchema.parse(request.body), actorFrom(principal)) });
  };

  latestResult = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { enrollmentId, lessonId } = studentQuizParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Test natijasi olindi.', data: await this.service.latestResult(enrollmentId, lessonId, actorFrom(principal)) });
  };

  teacherResults = async (request: Request, response: Response): Promise<void> => {
    const principal = principalFrom(request);
    const { courseId, lessonId } = learningParentParamsSchema.parse(request.params);
    response.status(200).json({ success: true, message: 'Test natijalari olindi.', data: await this.service.teacherResults(courseId, lessonId, actorFrom(principal)) });
  };
}
