import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherCoursesApi } from '../api/teacher-courses.api';
import type {
  CreateTeacherCourseInput,
  TeacherCourseListQuery,
  TeacherCourseStatus,
  UpdateTeacherCourseInput,
} from '../types/teacher-courses.types';
import { teacherCoursesQueryKeys } from './teacher-courses-query-keys';

export function useTeacherCourses(query: TeacherCourseListQuery) {
  return useQuery({
    queryKey: teacherCoursesQueryKeys.list(query),
    queryFn: () => teacherCoursesApi.list(query),
  });
}

export function useTeacherCourse(courseId: string) {
  return useQuery({
    queryKey: teacherCoursesQueryKeys.detail(courseId),
    queryFn: () => teacherCoursesApi.get(courseId),
    enabled: Boolean(courseId),
  });
}

export function useTeacherCourseEnrollments(courseId: string) {
  return useQuery({
    queryKey: teacherCoursesQueryKeys.enrollments(courseId),
    queryFn: () => teacherCoursesApi.listEnrollments(courseId),
    enabled: Boolean(courseId),
  });
}

export function useCreateTeacherCourse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherCourseInput) => teacherCoursesApi.create(input),
    onSuccess: (course) => {
      client.setQueryData(teacherCoursesQueryKeys.detail(course.id), course);
      void client.invalidateQueries({ queryKey: teacherCoursesQueryKeys.root });
    },
  });
}

export function useUpdateTeacherCourse(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeacherCourseInput) => teacherCoursesApi.update(courseId, input),
    onSuccess: (course) => {
      client.setQueryData(teacherCoursesQueryKeys.detail(courseId), course);
      void client.invalidateQueries({ queryKey: teacherCoursesQueryKeys.root });
    },
  });
}

export function useUpdateTeacherCourseStatus(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: TeacherCourseStatus) => teacherCoursesApi.updateStatus(courseId, status),
    onSuccess: (course) => {
      client.setQueryData(teacherCoursesQueryKeys.detail(courseId), course);
      void client.invalidateQueries({ queryKey: teacherCoursesQueryKeys.root });
    },
  });
}
