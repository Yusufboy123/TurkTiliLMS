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
