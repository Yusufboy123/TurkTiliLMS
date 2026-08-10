import { Prisma, RoleCode, UserStatus, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface RegistrationRepository {
  createStudent(input: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
  }): Promise<boolean>;
}

export class PrismaRegistrationRepository implements RegistrationRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async createStudent(input: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
  }): Promise<boolean> {
    try {
      await this.client.$transaction(async (transaction) => {
        const studentRole = await transaction.role.findUnique({
          where: { code: RoleCode.STUDENT },
          select: { id: true },
        });
        if (!studentRole) throw new Error('The STUDENT role is not seeded.');

        await transaction.user.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`.trim(),
            email: input.email,
            status: UserStatus.ACTIVE,
            credential: { create: { passwordHash: input.passwordHash } },
            roles: { create: { roleId: studentRole.id } },
          },
          select: { id: true },
        });
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
