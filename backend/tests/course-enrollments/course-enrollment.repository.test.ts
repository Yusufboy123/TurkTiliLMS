import { Prisma } from '@prisma/client';
import {
  CURRENT_MEMBERSHIP_UNIQUE_INDEX,
  isCurrentMembershipUniqueError,
} from '../../src/modules/course-enrollments/course-enrollment.repository.js';

function prismaError(code: string, target: unknown): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Test Prisma error', {
    code,
    clientVersion: 'test',
    meta: { target },
  });
}

describe('course enrollment repository error classification', () => {
  it('recognizes only the active-membership P2002 constraint', () => {
    expect(
      isCurrentMembershipUniqueError(prismaError('P2002', CURRENT_MEMBERSHIP_UNIQUE_INDEX)),
    ).toBe(true);
    expect(
      isCurrentMembershipUniqueError(prismaError('P2002', 'unrelated_unique_constraint')),
    ).toBe(false);
    expect(
      isCurrentMembershipUniqueError(prismaError('P2003', CURRENT_MEMBERSHIP_UNIQUE_INDEX)),
    ).toBe(false);
  });
});
