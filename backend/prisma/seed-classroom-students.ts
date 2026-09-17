import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  CourseLevel,
  PrismaClient,
  RoleCode,
  StudentLearningGoal,
  StudentOnboardingLevel,
  UserStatus,
} from '@prisma/client';
import { courseEnrollmentService } from '../src/modules/course-enrollments/course-enrollment.container.js';
import { BcryptPasswordService } from '../src/modules/auth/password.service.js';

const prisma = new PrismaClient();
const classroomCount = 30;
const classroomPrefix = 'student';
const credentialFile =
  process.env.CLASSROOM_CREDENTIALS_FILE ?? join(tmpdir(), 'turktililms-classroom-credentials.json');

type StoredCredential = { student: string; login: string; password: string };

function loginFor(index: number): string {
  return `${classroomPrefix}${String(index).padStart(2, '0')}@classroom.local`;
}

function displayNameFor(index: number): string {
  return `Student${String(index).padStart(2, '0')}`;
}

function generatePassword(index: number): string {
  return `TurkClass${String(index).padStart(2, '0')}-${randomBytes(12).toString('base64url')}`;
}

function loadCredentials(): Map<string, StoredCredential> {
  if (!existsSync(credentialFile)) return new Map();
  const parsed = JSON.parse(readFileSync(credentialFile, 'utf8')) as StoredCredential[];
  return new Map(parsed.map((item) => [item.login, item]));
}

function saveCredentials(credentials: StoredCredential[]): void {
  writeFileSync(credentialFile, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
}

async function main(): Promise<void> {
  const passwordService = new BcryptPasswordService(Number(process.env.BCRYPT_ROUNDS ?? 12));
  const stored = loadCredentials();
  const definitions = Array.from({ length: classroomCount }, (_, offset) => {
    const index = offset + 1;
    const login = loginFor(index);
    const existing = stored.get(login);
    return {
      index,
      student: displayNameFor(index),
      login,
      password: existing?.password ?? generatePassword(index),
    };
  });

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: definitions.map((definition) => definition.login) } },
    select: {
      id: true,
      email: true,
      status: true,
      deletedAt: true,
      credential: { select: { userId: true } },
      roles: { select: { role: { select: { code: true } } } },
      studentProfile: { select: { userId: true } },
    },
  });
  const existingByLogin = new Map(existingUsers.map((user) => [user.email, user]));

  for (const user of existingUsers) {
    if (user.credential && !stored.has(user.email)) {
      throw new Error(`${user.email} allaqachon mavjud, ammo uning vaqtinchalik paroli saqlanmagan.`);
    }
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new Error(`${user.email} faol emas; avtomatik qayta faollashtirish rad etildi.`);
    }
    if (user.roles.some((assignment) => assignment.role.code !== RoleCode.STUDENT)) {
      throw new Error(`${user.email} STUDENT bo‘lmagan qo‘shimcha rolga ega.`);
    }
  }

  const studentRole = await prisma.role.findUnique({ where: { code: RoleCode.STUDENT }, select: { id: true } });
  if (!studentRole) throw new Error('STUDENT roli topilmadi. Avval asosiy seedni ishga tushiring.');

  const credentials = [] as StoredCredential[];
  for (const definition of definitions) {
    const current = existingByLogin.get(definition.login);
    await prisma.$transaction(async (transaction) => {
      if (!current) {
        const passwordHash = await passwordService.hash(definition.password);
        return transaction.user.create({
          data: {
            email: definition.login,
            firstName: 'Student',
            lastName: String(definition.index).padStart(2, '0'),
            displayName: definition.student,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            credential: { create: { passwordHash, requiresPasswordChange: true } },
            roles: { create: { roleId: studentRole.id } },
            studentProfile: {
              create: {
                currentLevel: StudentOnboardingLevel.A1,
                learningGoal: StudentLearningGoal.DAILY_COMMUNICATION,
                onboardingCompletedAt: new Date(),
              },
            },
          },
          select: { id: true },
        });
      }

      if (!current.roles.some((assignment) => assignment.role.code === RoleCode.STUDENT)) {
        await transaction.userRole.create({ data: { userId: current.id, roleId: studentRole.id } });
      }
      if (!current.credential) {
        const passwordHash = await passwordService.hash(definition.password);
        await transaction.userCredential.create({
          data: { userId: current.id, passwordHash, requiresPasswordChange: true },
        });
      }
      if (!current.studentProfile) {
        await transaction.studentProfile.create({
          data: {
            userId: current.id,
            currentLevel: StudentOnboardingLevel.A1,
            learningGoal: StudentLearningGoal.DAILY_COMMUNICATION,
            onboardingCompletedAt: new Date(),
          },
        });
      }
      return { id: current.id };
    });
    credentials.push({ student: definition.student, login: definition.login, password: definition.password });
  }

  const administrator = await prisma.user.findFirst({
    where: { status: UserStatus.ACTIVE, deletedAt: null, roles: { some: { role: { code: RoleCode.ADMIN } } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      email: true,
      roles: { select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
    },
  });
  if (!administrator) throw new Error('Faol ADMIN hisob topilmadi.');
  const actor = {
    userId: administrator.id,
    roles: administrator.roles.map((assignment) => assignment.role.code),
    permissions: administrator.roles.flatMap((assignment) => assignment.role.permissions.map((permission) => permission.permission.code)),
  };

  const a1Courses = await prisma.course.findMany({
    where: { level: CourseLevel.A1, status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, _count: { select: { lessons: true } } },
  });
  const a1Course = [...a1Courses].sort((left, right) => right._count.lessons - left._count.lessons)[0];
  if (!a1Course) throw new Error('Nashr qilingan A1 kurs topilmadi.');

  const userIds: string[] = [];
  for (const definition of definitions) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: definition.login }, select: { id: true } });
    userIds.push(user.id);
    const existingEnrollment = await prisma.courseEnrollment.findFirst({
      where: { courseId: a1Course.id, studentId: user.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!existingEnrollment) {
      await courseEnrollmentService.createManaged(a1Course.id, user.id, actor, {
        actorUserId: administrator.id,
        userAgentSummary: 'local-classroom-seed',
      });
    }
  }

  saveCredentials(credentials);
  const activeEnrollments = await prisma.courseEnrollment.count({
    where: { courseId: a1Course.id, status: 'ACTIVE', studentId: { in: userIds } },
  });
  const duplicateGroups = await prisma.courseEnrollment.groupBy({
    by: ['studentId'],
    where: { courseId: a1Course.id, status: 'ACTIVE', studentId: { in: userIds } },
    _count: { studentId: true },
  });
  const duplicateCount = duplicateGroups.reduce((sum, group) => sum + Math.max(0, group._count.studentId - 1), 0);
  console.log(JSON.stringify({
    classroomAccounts: userIds.length,
    a1Course: { id: a1Course.id, title: a1Course.title },
    activeA1Enrollments: activeEnrollments,
    duplicateActiveEnrollments: duplicateCount,
    administrator: administrator.email,
    credentialFile,
    credentials,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Classroom seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
