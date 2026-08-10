import { CourseEnrollmentStatus, RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { StudentMonitoringService } from '../../src/modules/student-monitoring/student-monitoring.service.js';
import type { StudentMonitoringRepository } from '../../src/modules/student-monitoring/student-monitoring.repository.js';
import type {
  MonitoringCourseRecord,
  MonitoringStudentReference,
  StudentMonitoringQuery,
} from '../../src/modules/student-monitoring/student-monitoring.types.js';

const teacherId = '019b9e22-e356-713e-be3a-ab43b5b43f8b';
const studentId = '019b9e22-e356-713e-be3a-ab43b5b43f8c';
const student: MonitoringStudentReference = {
  id: studentId,
  email: 'student@example.com',
  firstName: 'Ali',
  lastName: 'Talaba',
  displayName: 'Ali Talaba',
  registeredAt: new Date('2026-08-01T00:00:00Z'),
};
const course: MonitoringCourseRecord = {
  enrollmentId: '019b9e22-e356-713e-be3a-ab43b5b43f8d',
  course: { id: '019b9e22-e356-713e-be3a-ab43b5b43f8e', title: 'A1 kursi', slug: 'a1-kursi' },
  enrollmentStatus: CourseEnrollmentStatus.ACTIVE,
  percentage: 40,
  completedLessons: 2,
  totalEligibleLessons: 5,
  lastActivityAt: new Date('2026-08-09T00:00:00Z'),
  completedAt: null,
  currentLesson: {
    id: '019b9e22-e356-713e-be3a-ab43b5b43f8f',
    title: 'Alifbo',
    sectionTitle: 'Boshlanish',
  },
  certificateStatus: null,
};
class FakeRepository implements StudentMonitoringRepository {
  async listStudents(_query: StudentMonitoringQuery, _teacherId?: string) {
    return { students: [student], total: 1, newStudentCount: 1 };
  }
  async listEnrollments() {
    return new Map([[studentId, [course]]]);
  }
  async findStudent(id: string) {
    return id === studentId ? student : null;
  }
  async findStudentEnrollments() {
    return [course];
  }
  async studentHasScopedEnrollment() {
    return true;
  }
}

describe('StudentMonitoringService', () => {
  it('returns scoped students and authoritative progress summaries', async () => {
    const service = new StudentMonitoringService(new FakeRepository());
    const result = await service.list(
      { page: 1, pageSize: 20 },
      { userId: teacherId, roles: [RoleCode.TEACHER], permissions: ['progress.course.read'] },
    );
    expect(result.items[0]).toMatchObject({
      id: studentId,
      overallPercentage: 40,
      currentCourse: { title: 'A1 kursi' },
    });
    expect(result.newStudentCount).toBe(1);
  });
  it('returns student detail with current lesson and certificate projection', async () => {
    const service = new StudentMonitoringService(new FakeRepository());
    const result = await service.getById(studentId, {
      userId: teacherId,
      roles: [RoleCode.TEACHER],
      permissions: ['progress.course.read'],
    });
    expect(result).toMatchObject({
      overallPercentage: 40,
      completedCourses: 0,
      courses: [{ currentLesson: { title: 'Alifbo' }, certificateStatus: null }],
    });
  });
  it('denies monitoring without the teacher progress permission', async () => {
    await expect(
      new StudentMonitoringService(new FakeRepository()).list(
        { page: 1, pageSize: 20 },
        { userId: teacherId, roles: [RoleCode.TEACHER], permissions: [] },
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED', statusCode: 403 });
  });
});
