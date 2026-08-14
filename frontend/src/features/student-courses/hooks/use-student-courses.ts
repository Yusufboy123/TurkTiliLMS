import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { progressQueryKeys } from '../../progress/hooks/progress-query-keys';
import { studentCoursesApi } from '../api/student-courses.api';
import type {
  StudentEnrollment,
  StudentEnrollmentPage,
} from '../types/student-courses.types';
import { studentCoursesQueryKeys } from './student-courses-query-keys';
import { levelFinalExamApi } from '../../level-final-exam/api/level-final-exam.api';

function enrollmentDate(enrollment: StudentEnrollment): number {
  return new Date(enrollment.enrolledAt).getTime();
}

export function latestEnrollmentsByCourse(enrollments: readonly StudentEnrollment[]) {
  const latest = new Map<string, StudentEnrollment>();
  for (const enrollment of enrollments) {
    const existing = latest.get(enrollment.courseId);
    if (!existing || enrollmentDate(enrollment) > enrollmentDate(existing)) {
      latest.set(enrollment.courseId, enrollment);
    }
  }
  return latest;
}

export function useStudentCourses() {
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: studentCoursesQueryKeys.catalog(),
    queryFn: studentCoursesApi.listCatalog,
  });
  const enrollments = useQuery({
    queryKey: studentCoursesQueryKeys.enrollments(),
    queryFn: studentCoursesApi.listEnrollments,
  });
  const levelGates = useQuery({ queryKey: ['level-gates'], queryFn: levelFinalExamApi.gates });
  const enrollment = useMutation({
    mutationFn: studentCoursesApi.selfEnroll,
    onSuccess: (created) => {
      queryClient.setQueryData<StudentEnrollmentPage>(
        studentCoursesQueryKeys.enrollments(),
        (current) => {
          if (!current) return current;
          const alreadyListed = current.items.some((item) => item.courseId === created.courseId);
          const items = [
            created,
            ...current.items.filter((item) => item.courseId !== created.courseId),
          ];
          return {
            ...current,
            items,
            pagination: {
              ...current.pagination,
              totalItems: current.pagination.totalItems + (alreadyListed ? 0 : 1),
            },
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: progressQueryKeys.summaryRoot() });
    },
  });

  return { catalog, enrollments, enrollment, levelGates };
}
