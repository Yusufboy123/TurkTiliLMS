import 'dotenv/config';
import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { normalizeEmail, strongPasswordSchema } from '../src/modules/auth/auth.schemas.js';
import { BcryptPasswordService } from '../src/modules/auth/password.service.js';

const inputSchema = z.object({
  email: z.email('O‘qituvchi email manzili noto‘g‘ri.').transform(normalizeEmail),
  password: strongPasswordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  bcryptRounds: z.coerce.number().int().min(10).max(15).default(12),
});

const input = inputSchema.safeParse({
  email: process.env.BOOTSTRAP_TEACHER_EMAIL,
  password: process.env.BOOTSTRAP_TEACHER_PASSWORD,
  firstName: process.env.BOOTSTRAP_TEACHER_FIRST_NAME,
  lastName: process.env.BOOTSTRAP_TEACHER_LAST_NAME,
  bcryptRounds: process.env.BCRYPT_ROUNDS,
});

if (!input.success) {
  throw new Error(`O‘qituvchi ma’lumotlari noto‘g‘ri.\n${z.prettifyError(input.error)}`);
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: input.data.email },
    select: { credential: { select: { userId: true } }, roles: { select: { role: { select: { code: true } } } } },
  });
  if (existing) {
    if (existing.credential && existing.roles.some(({ role }) => role.code === RoleCode.TEACHER)) {
      console.info('O‘qituvchi allaqachon mavjud. Hech narsa o‘zgartirilmadi.');
      return;
    }
    throw new Error('Bu email boshqa yoki to‘liq sozlanmagan hisobga tegishli.');
  }

  const teacherRole = await prisma.role.findUnique({ where: { code: RoleCode.TEACHER }, select: { id: true } });
  if (!teacherRole) throw new Error('TEACHER roli topilmadi. Avval asosiy seedni bajaring.');
  const passwordHash = await new BcryptPasswordService(input.data.bcryptRounds).hash(input.data.password);
  await prisma.user.create({
    data: {
      email: input.data.email,
      firstName: input.data.firstName,
      lastName: input.data.lastName,
      displayName: `${input.data.firstName} ${input.data.lastName}`,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      credential: { create: { passwordHash } },
      roles: { create: { roleId: teacherRole.id } },
    },
    select: { id: true },
  });
  console.info('O‘qituvchi hisobi yaratildi.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'O‘qituvchi yaratilmadi.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
