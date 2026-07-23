import 'dotenv/config';
import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { normalizeEmail, strongPasswordSchema } from '../src/modules/auth/auth.schemas.js';
import { BcryptPasswordService } from '../src/modules/auth/password.service.js';

const bootstrapInputSchema = z.object({
  email: z.email('Administrator email manzili noto‘g‘ri.').transform(normalizeEmail),
  password: strongPasswordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  bcryptRounds: z.coerce.number().int().min(10).max(15).default(12),
});

const input = bootstrapInputSchema.safeParse({
  email: process.env.BOOTSTRAP_ADMIN_EMAIL,
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME,
  lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME,
  bcryptRounds: process.env.BCRYPT_ROUNDS,
});

if (!input.success) {
  throw new Error(
    [
      'Administrator bootstrap muhiti noto‘g‘ri sozlangan.',
      z.prettifyError(input.error),
      'BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD,',
      'BOOTSTRAP_ADMIN_FIRST_NAME va BOOTSTRAP_ADMIN_LAST_NAME qiymatlarini tekshiring.',
    ].join('\n'),
  );
}

const bootstrapInput = input.data;
const prisma = new PrismaClient();

async function bootstrapAdministrator(): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { email: bootstrapInput.email },
    select: {
      id: true,
      credential: { select: { userId: true } },
      roles: {
        select: {
          role: { select: { code: true } },
        },
      },
    },
  });

  if (existingUser) {
    const isInitializedAdministrator =
      existingUser.credential !== null &&
      existingUser.roles.some((assignment) => assignment.role.code === RoleCode.ADMIN);

    if (isInitializedAdministrator) {
      console.info('Administrator allaqachon mavjud. Hech qanday ma’lumot o‘zgartirilmadi.');
      return;
    }

    throw new Error(
      'Bu email bilan foydalanuvchi mavjud, ammo xavfsiz administrator sifatida sozlanmagan. Avtomatik o‘zgartirish rad etildi.',
    );
  }

  const adminRole = await prisma.role.findUnique({
    where: { code: RoleCode.ADMIN },
    select: { id: true },
  });

  if (!adminRole) {
    throw new Error('ADMIN roli topilmadi. Avval `npm run prisma:seed` buyrug‘ini bajaring.');
  }

  const passwordService = new BcryptPasswordService(bootstrapInput.bcryptRounds);
  const passwordHash = await passwordService.hash(bootstrapInput.password);

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        email: bootstrapInput.email,
        firstName: bootstrapInput.firstName,
        lastName: bootstrapInput.lastName,
        displayName: `${bootstrapInput.firstName} ${bootstrapInput.lastName}`,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        credential: {
          create: {
            passwordHash,
            requiresPasswordChange: false,
          },
        },
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
      select: { id: true, email: true },
    });

    await transaction.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'identity.admin_bootstrapped',
        subjectType: 'user',
        subjectId: user.id,
        metadata: { source: 'secure_cli_bootstrap' },
      },
    });
  });

  console.info(`Administrator yaratildi: ${bootstrapInput.email}`);
}

try {
  await bootstrapAdministrator();
} catch (error: unknown) {
  console.error(
    'Administrator yaratilmadi.',
    error instanceof Error ? error.message : 'Noma’lum xatolik.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
