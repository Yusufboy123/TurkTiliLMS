import { useQuery } from '@tanstack/react-query';
import { teacherStudentsApi } from '../api/teacher-students.api';

export function useTeacherStudents(search: string) {
  return useQuery({
    queryKey: ['teacher-students', 'list', search],
    queryFn: () => teacherStudentsApi.list(search),
    staleTime: 15_000,
  });
}

export function useTeacherStudent(studentId: string) {
  return useQuery({
    queryKey: ['teacher-students', 'detail', studentId],
    queryFn: () => teacherStudentsApi.getById(studentId),
    enabled: Boolean(studentId),
  });
}
