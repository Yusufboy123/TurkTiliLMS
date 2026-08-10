import { describe, expect, it, vi } from 'vitest';
import { CourseEnrollmentStatus, type PrismaClient } from '@prisma/client';
import { PrismaStudentCourseContentAccess } from '../../src/modules/course-enrollments/course-content-access.js';

describe('student course content access', () => {
  it('allows active and completed student enrollments only', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ id: 'active-enrollment' })
      .mockResolvedValueOnce({ id: 'completed-enrollment' })
      .mockResolvedValueOnce(null);
    const client = { courseEnrollment: { findFirst } } as unknown as PrismaClient;
    const access = new PrismaStudentCourseContentAccess(client);

    await expect(access.hasAccess('course-1', 'student-1')).resolves.toBe(true);
    await expect(access.hasAccess('course-1', 'student-1')).resolves.toBe(true);
    await expect(access.hasAccess('course-1', 'student-1')).resolves.toBe(false);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
      }),
    }));
  });
});
