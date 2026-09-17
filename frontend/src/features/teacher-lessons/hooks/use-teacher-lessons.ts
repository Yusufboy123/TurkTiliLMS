import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherLessonsApi } from '../api/teacher-lessons.api';
import type {
  CreateTeacherBlockInput,
  CreateTeacherLessonInput,
  CreateTeacherSectionInput,
  TeacherLessonListQuery,
  UpdateTeacherBlockInput,
  UpdateTeacherLessonInput,
  ReorderTeacherLessonInput,
  CreateTeacherVocabularyInput,
  UpdateTeacherVocabularyInput,
  CreateTeacherQuizQuestionInput,
  UpdateTeacherQuizQuestionInput,
  InteractivePracticeItem,
} from '../types/teacher-lessons.types';
import { teacherLessonsQueryKeys } from './teacher-lessons-query-keys';

export function useTeacherSections(courseId: string) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.sections(courseId),
    queryFn: () => teacherLessonsApi.listSections(courseId),
    enabled: Boolean(courseId),
  });
}

export function useTeacherLessons(courseId: string, query: TeacherLessonListQuery) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.list(courseId, query),
    queryFn: () => teacherLessonsApi.list(courseId, query),
    enabled: Boolean(courseId),
  });
}

export function useTeacherLesson(courseId: string, lessonId: string) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.detail(courseId, lessonId),
    queryFn: () => teacherLessonsApi.get(courseId, lessonId),
    enabled: Boolean(courseId && lessonId),
  });
}

export function useTeacherLessonBlocks(courseId: string, lessonId: string) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.blocks(courseId, lessonId),
    queryFn: () => teacherLessonsApi.listBlocks(courseId, lessonId),
    enabled: Boolean(courseId && lessonId),
  });
}

export function useCreateTeacherSection(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherSectionInput) => teacherLessonsApi.createSection(courseId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.sections(courseId) }),
  });
}

export function useCreateTeacherLesson(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherLessonInput) => teacherLessonsApi.create(courseId, input),
    onSuccess: (lesson) => {
      client.setQueryData(teacherLessonsQueryKeys.detail(courseId, lesson.id), lesson);
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.list(courseId, {}) });
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.root });
    },
  });
}

export function useUpdateTeacherLesson(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeacherLessonInput) => teacherLessonsApi.update(courseId, lessonId, input),
    onSuccess: (lesson) => {
      client.setQueryData(teacherLessonsQueryKeys.detail(courseId, lessonId), lesson);
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.root });
    },
  });
}

export function useDuplicateTeacherLesson(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => teacherLessonsApi.duplicate(courseId, lessonId),
    onSuccess: (lesson) => {
      client.setQueryData(teacherLessonsQueryKeys.detail(courseId, lesson.id), lesson);
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.list(courseId, {}) });
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.root });
    },
  });
}

export function useReorderTeacherLesson(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderTeacherLessonInput) => teacherLessonsApi.reorder(courseId, lessonId, input),
    onSuccess: (lesson) => {
      client.setQueryData(teacherLessonsQueryKeys.detail(courseId, lessonId), lesson);
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.root });
    },
  });
}

export function useCreateTeacherBlock(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherBlockInput) => teacherLessonsApi.createBlock(courseId, lessonId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.blocks(courseId, lessonId) }),
  });
}

export function useUpdateTeacherBlock(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, input }: { blockId: string; input: UpdateTeacherBlockInput }) =>
      teacherLessonsApi.updateBlock(courseId, lessonId, blockId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.blocks(courseId, lessonId) }),
  });
}

export function useTeacherLessonVocabulary(courseId: string, lessonId: string, enabled = true) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.vocabulary(courseId, lessonId),
    queryFn: () => teacherLessonsApi.listVocabulary(courseId, lessonId),
    enabled: enabled && Boolean(courseId && lessonId),
  });
}

export function useCreateTeacherVocabulary(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherVocabularyInput) => teacherLessonsApi.createVocabulary(courseId, lessonId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.vocabulary(courseId, lessonId) }),
  });
}

export function useUpdateTeacherVocabulary(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ vocabularyId, input }: { vocabularyId: string; input: UpdateTeacherVocabularyInput }) => teacherLessonsApi.updateVocabulary(courseId, lessonId, vocabularyId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.vocabulary(courseId, lessonId) }),
  });
}

export function useDeleteTeacherVocabulary(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vocabularyId: string) => teacherLessonsApi.deleteVocabulary(courseId, lessonId, vocabularyId),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.vocabulary(courseId, lessonId) }),
  });
}

export function useTeacherLessonQuizQuestions(courseId: string, lessonId: string, enabled = true) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.quizQuestions(courseId, lessonId),
    queryFn: () => teacherLessonsApi.listQuizQuestions(courseId, lessonId),
    enabled: enabled && Boolean(courseId && lessonId),
  });
}

export function useCreateTeacherQuizQuestion(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherQuizQuestionInput) => teacherLessonsApi.createQuizQuestion(courseId, lessonId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.quizQuestions(courseId, lessonId) }),
  });
}

export function useUpdateTeacherQuizQuestion(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, input }: { questionId: string; input: UpdateTeacherQuizQuestionInput }) => teacherLessonsApi.updateQuizQuestion(courseId, lessonId, questionId, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.quizQuestions(courseId, lessonId) }),
  });
}

export function useDeleteTeacherQuizQuestion(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => teacherLessonsApi.deleteQuizQuestion(courseId, lessonId, questionId),
    onSuccess: () => void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.quizQuestions(courseId, lessonId) }),
  });
}

export function useTeacherLessonQuizResults(courseId: string, lessonId: string, enabled = true) {
  return useQuery({
    queryKey: teacherLessonsQueryKeys.quizResults(courseId, lessonId),
    queryFn: () => teacherLessonsApi.listQuizResults(courseId, lessonId),
    enabled: enabled && Boolean(courseId && lessonId),
  });
}

export function useUpsertTeacherPracticeHolder(courseId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (interactivePractice: InteractivePracticeItem[]) =>
      teacherLessonsApi.upsertPracticeHolder(courseId, lessonId, interactivePractice),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.blocks(courseId, lessonId) });
      void client.invalidateQueries({ queryKey: teacherLessonsQueryKeys.detail(courseId, lessonId) });
    },
  });
}
