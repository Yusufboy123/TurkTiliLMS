import type { SuccessEnvelope } from '../../auth/types/auth.types';
import { apiClient } from '../../../lib/api-client';
import type {
  CatalogCoursePage,
  StudentEnrollment,
  StudentEnrollmentPage,
} from '../types/student-courses.types';

const catalogQuery = {
  page: 1,
  pageSize: 100,
  sortBy: 'sortOrder',
  sortDirection: 'asc',
} as const;

const enrollmentQuery = {
  page: 1,
  pageSize: 100,
  sortBy: 'enrolledAt',
  sortDirection: 'desc',
} as const;

export const studentCoursesApi = {
  async listCatalog(): Promise<CatalogCoursePage> {
    const response = await apiClient.get<SuccessEnvelope<CatalogCoursePage>>('/catalog/courses', {
      params: catalogQuery,
    });
    return response.data.data;
  },

  async listEnrollments(): Promise<StudentEnrollmentPage> {
    const response = await apiClient.get<SuccessEnvelope<StudentEnrollmentPage>>(
      '/me/enrollments',
      { params: enrollmentQuery },
    );
    return response.data.data;
  },

  async selfEnroll(courseId: string): Promise<StudentEnrollment> {
    const response = await apiClient.post<SuccessEnvelope<StudentEnrollment>>(
      `/courses/${courseId}/enrollments/self`,
      {},
    );
    return response.data.data;
  },
};

export { catalogQuery, enrollmentQuery };
