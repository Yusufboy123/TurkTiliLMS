import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { StudentMonitoringRepository } from './student-monitoring.repository.js';
import type {
  MonitoringCourseRecord,
  StudentMonitoringActor,
  StudentMonitoringQuery,
  StudentMonitoringPage,
  MonitoringStudentDetail,
  MonitoringStudentListItem,
} from './student-monitoring.types.js';

const isAdmin = (actor: StudentMonitoringActor) => actor.roles.includes(RoleCode.ADMIN);
const scopeTeacher = (actor: StudentMonitoringActor) => (isAdmin(actor) ? undefined : actor.userId);
const progressPercentage = (courses: MonitoringCourseRecord[]) =>
  courses.length
    ? Math.round(courses.reduce((sum, course) => sum + course.percentage, 0) / courses.length)
    : 0;

function assertPermission(actor: StudentMonitoringActor) {
  if (!actor.permissions.includes('progress.course.read'))
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

function toListItem(
  student: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    registeredAt: Date;
  },
  courses: MonitoringCourseRecord[],
): MonitoringStudentListItem {
  const current =
    [...courses].sort(
      (a, b) =>
        (b.lastActivityAt?.getTime() ?? b.completedAt?.getTime() ?? 0) -
        (a.lastActivityAt?.getTime() ?? a.completedAt?.getTime() ?? 0),
    )[0] ?? null;
  return {
    ...student,
    overallPercentage: progressPercentage(courses),
    currentCourse: current ? { id: current.course.id, title: current.course.title } : null,
    lastActivityAt: courses.reduce<Date | null>(
      (latest, course) =>
        !course.lastActivityAt || (latest && latest >= course.lastActivityAt)
          ? latest
          : course.lastActivityAt,
      null,
    ),
    enrollmentCount: courses.length,
  };
}

export class StudentMonitoringService {
  constructor(private readonly repository: StudentMonitoringRepository) {}

  async list(
    query: StudentMonitoringQuery,
    actor: StudentMonitoringActor,
  ): Promise<StudentMonitoringPage> {
    assertPermission(actor);
    const teacherId = scopeTeacher(actor);
    const result = await this.repository.listStudents(query, teacherId);
    const enrollments = await this.repository.listEnrollments(
      result.students.map((student) => student.id),
      teacherId,
    );
    return {
      items: result.students.map((student) =>
        toListItem(student, enrollments.get(student.id) ?? []),
      ),
      newStudentCount: result.newStudentCount,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async getById(
    studentId: string,
    actor: StudentMonitoringActor,
  ): Promise<MonitoringStudentDetail> {
    assertPermission(actor);
    const student = await this.repository.findStudent(studentId);
    if (!student) throw new AppError('Talaba topilmadi.', 404, 'STUDENT_NOT_FOUND');
    const courses = await this.repository.findStudentEnrollments(studentId, scopeTeacher(actor));
    if (!courses.length)
      throw new AppError(
        'Bu talabaning jarayonini ko‘rishga ruxsat yetarli emas.',
        403,
        'PROGRESS_SCOPE_DENIED',
      );
    return {
      student,
      overallPercentage: progressPercentage(courses),
      completedCourses: courses.filter((course) => course.enrollmentStatus === 'COMPLETED').length,
      courses,
    };
  }
}
