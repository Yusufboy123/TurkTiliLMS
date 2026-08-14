import { CourseEnrollmentStatus, RoleCode, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { PrismaLevelGate } from '../level-final-exam/level-gate.js';

export interface StudentCourseContentAccess {
  hasAccess(courseId: string, studentId: string): Promise<boolean>;
}

/** Read-only enrollment policy shared by catalog content delivery. */
export class PrismaStudentCourseContentAccess implements StudentCourseContentAccess {
  private readonly levelGate: PrismaLevelGate;

  constructor(private readonly client: PrismaClient = prisma) {
    this.levelGate = new PrismaLevelGate(client);
  }

  async hasAccess(courseId: string, studentId: string): Promise<boolean> {
    const enrollment = await this.client.courseEnrollment.findFirst({
      where: {
        courseId,
        studentId,
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
        accessStartsAt: { lte: new Date() },
        accessExpiresAt: { gt: new Date() },
        student: {
          status: 'ACTIVE',
          roles: { some: { role: { code: RoleCode.STUDENT } } },
        },
      },
      select: { id: true },
    });
    return enrollment !== null && (await this.levelGate.canAccessCourse(courseId, studentId));
  }
}
