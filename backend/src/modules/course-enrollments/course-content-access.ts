import { CourseEnrollmentStatus, RoleCode, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface StudentCourseContentAccess {
  hasAccess(courseId: string, studentId: string): Promise<boolean>;
}

/** Read-only enrollment policy shared by catalog content delivery. */
export class PrismaStudentCourseContentAccess implements StudentCourseContentAccess {
  constructor(private readonly client: PrismaClient = prisma) {}

  async hasAccess(courseId: string, studentId: string): Promise<boolean> {
    const enrollment = await this.client.courseEnrollment.findFirst({
      where: {
        courseId,
        studentId,
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
        student: {
          status: 'ACTIVE',
          roles: { some: { role: { code: RoleCode.STUDENT } } },
        },
      },
      select: { id: true },
    });
    return enrollment !== null;
  }
}
