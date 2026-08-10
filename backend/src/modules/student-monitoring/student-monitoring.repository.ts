import {
  CourseEnrollmentStatus,
  RoleCode,
  UserStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  MonitoringCourseRecord,
  MonitoringStudentReference,
  StudentMonitoringQuery,
} from './student-monitoring.types.js';

const studentSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const enrollmentSelect = {
  id: true,
  studentId: true,
  status: true,
  completedAt: true,
  course: { select: { id: true, title: true, slug: true } },
  progressRoot: {
    select: {
      coursePercentage: true,
      completedLessons: true,
      totalEligibleLessons: true,
      lastVisitedAt: true,
      lastVisitedLesson: {
        select: { id: true, title: true, section: { select: { title: true } } },
      },
    },
  },
  certificate: { select: { status: true } },
} satisfies Prisma.CourseEnrollmentSelect;

type StudentPayload = Prisma.UserGetPayload<{ select: typeof studentSelect }>;
type EnrollmentPayload = Prisma.CourseEnrollmentGetPayload<{ select: typeof enrollmentSelect }>;

function mapStudent(student: StudentPayload): MonitoringStudentReference {
  return {
    id: student.id,
    email: student.email,
    firstName: student.firstName,
    lastName: student.lastName,
    displayName: student.displayName,
    registeredAt: student.createdAt,
  };
}

function mapEnrollment(enrollment: EnrollmentPayload): MonitoringCourseRecord {
  return {
    enrollmentId: enrollment.id,
    course: enrollment.course,
    enrollmentStatus: enrollment.status,
    percentage:
      enrollment.status === CourseEnrollmentStatus.COMPLETED
        ? 100
        : (enrollment.progressRoot?.coursePercentage ?? 0),
    completedLessons: enrollment.progressRoot?.completedLessons ?? 0,
    totalEligibleLessons: enrollment.progressRoot?.totalEligibleLessons ?? 0,
    lastActivityAt: enrollment.progressRoot?.lastVisitedAt ?? null,
    completedAt: enrollment.completedAt,
    currentLesson: enrollment.progressRoot?.lastVisitedLesson
      ? {
          id: enrollment.progressRoot.lastVisitedLesson.id,
          title: enrollment.progressRoot.lastVisitedLesson.title,
          sectionTitle: enrollment.progressRoot.lastVisitedLesson.section.title,
        }
      : null,
    certificateStatus: enrollment.certificate?.status ?? null,
  };
}

function studentWhere(query: StudentMonitoringQuery, teacherId?: string): Prisma.UserWhereInput {
  return {
    status: UserStatus.ACTIVE,
    deletedAt: null,
    roles: {
      some: {
        role: { code: RoleCode.STUDENT },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    },
    courseEnrollments: {
      some: {
        ...(teacherId ? { course: { teacherId } } : {}),
      },
    },
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export interface StudentMonitoringRepository {
  listStudents(
    query: StudentMonitoringQuery,
    teacherId?: string,
  ): Promise<{ students: MonitoringStudentReference[]; total: number; newStudentCount: number }>;
  listEnrollments(
    studentIds: string[],
    teacherId?: string,
  ): Promise<Map<string, MonitoringCourseRecord[]>>;
  findStudent(studentId: string): Promise<MonitoringStudentReference | null>;
  findStudentEnrollments(studentId: string, teacherId?: string): Promise<MonitoringCourseRecord[]>;
  studentHasScopedEnrollment(studentId: string, teacherId?: string): Promise<boolean>;
}

export class PrismaStudentMonitoringRepository implements StudentMonitoringRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async listStudents(query: StudentMonitoringQuery, teacherId?: string) {
    const where = studentWhere(query, teacherId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
    const [students, total, newStudentCount] = await this.client.$transaction([
      this.client.user.findMany({
        where,
        select: studentSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.user.count({ where }),
      this.client.user.count({ where: { AND: [where, { createdAt: { gte: sevenDaysAgo } }] } }),
    ]);
    return { students: students.map(mapStudent), total, newStudentCount };
  }

  async listEnrollments(studentIds: string[], teacherId?: string) {
    const rows = await this.client.courseEnrollment.findMany({
      where: { studentId: { in: studentIds }, ...(teacherId ? { course: { teacherId } } : {}) },
      select: enrollmentSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    const result = new Map<string, MonitoringCourseRecord[]>();
    for (const row of rows)
      result.set(row.studentId, [...(result.get(row.studentId) ?? []), mapEnrollment(row)]);
    return result;
  }

  async findStudent(studentId: string) {
    const student = await this.client.user.findFirst({
      where: {
        id: studentId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: {
          some: {
            role: { code: RoleCode.STUDENT },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
      select: studentSelect,
    });
    return student ? mapStudent(student) : null;
  }

  async findStudentEnrollments(studentId: string, teacherId?: string) {
    const rows = await this.client.courseEnrollment.findMany({
      where: { studentId, ...(teacherId ? { course: { teacherId } } : {}) },
      select: enrollmentSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(mapEnrollment);
  }

  async studentHasScopedEnrollment(studentId: string, teacherId?: string) {
    return Boolean(
      await this.client.courseEnrollment.findFirst({
        where: { studentId, ...(teacherId ? { course: { teacherId } } : {}) },
        select: { id: true },
      }),
    );
  }
}
