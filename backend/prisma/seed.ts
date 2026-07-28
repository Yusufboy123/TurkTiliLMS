import 'dotenv/config';
import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityPolicyCode,
  PrismaClient,
  RoleCode,
  UserStatus,
  type Role,
} from '@prisma/client';
import { z } from 'zod';
import { BcryptPasswordService } from '../src/modules/auth/password.service.js';

const prisma = new PrismaClient();

const seedConfiguration = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    SEED_DEVELOPMENT_USERS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .parse(process.env);

const roleDefinitions = [
  {
    code: RoleCode.ADMIN,
    name: 'Administrator',
    description: 'Full platform administration within explicitly granted permissions.',
  },
  {
    code: RoleCode.TEACHER,
    name: 'Teacher',
    description: 'Instructional role without platform administration permissions.',
  },
  {
    code: RoleCode.STUDENT,
    name: 'Student',
    description: 'Learner role without administrative permissions.',
  },
] as const;

const developmentUserDefinitions = [
  {
    email: 'admin@turktili.local',
    password: 'Admin123!',
    firstName: 'Development',
    lastName: 'Admin',
    displayName: 'Development Admin',
    role: RoleCode.ADMIN,
  },
  {
    email: 'teacher@turktili.local',
    password: 'Teacher123!',
    firstName: 'Development',
    lastName: 'Teacher',
    displayName: 'Development Teacher',
    role: RoleCode.TEACHER,
  },
  {
    email: 'student@turktili.local',
    password: 'Student123!',
    firstName: 'Development',
    lastName: 'Student',
    displayName: 'Development Student',
    role: RoleCode.STUDENT,
  },
] as const;

const certificateEligibilityPolicyDefinition = {
  code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
  version: 1,
  assessmentRule: CertificateEligibilityAssessmentRule.NONE,
  requiresAttendance: false,
  requiresManualApproval: false,
} as const;

const permissionDefinitions = [
  {
    code: 'users.read',
    resource: 'users',
    action: 'read',
    description: 'View permitted user accounts.',
  },
  {
    code: 'users.create',
    resource: 'users',
    action: 'create',
    description: 'Create user accounts.',
  },
  {
    code: 'users.update',
    resource: 'users',
    action: 'update',
    description: 'Update permitted user account fields.',
  },
  {
    code: 'users.suspend',
    resource: 'users',
    action: 'suspend',
    description: 'Suspend user accounts and revoke active access.',
  },
  {
    code: 'users.deactivate',
    resource: 'users',
    action: 'deactivate',
    description: 'Deactivate user accounts.',
  },
  {
    code: 'users.restore',
    resource: 'users',
    action: 'restore',
    description: 'Restore eligible suspended, deactivated, or soft-deleted accounts.',
  },
  {
    code: 'users.delete',
    resource: 'users',
    action: 'delete',
    description: 'Soft-delete or anonymize user accounts according to retention policy.',
  },
  {
    code: 'users.password-reset',
    resource: 'users',
    action: 'password-reset',
    description: 'Initiate a secure user password-reset flow.',
  },
  {
    code: 'users.activity.read',
    resource: 'users.activity',
    action: 'read',
    description: 'View permitted account session and activity information.',
  },
  {
    code: 'sessions.revoke',
    resource: 'sessions',
    action: 'revoke',
    description: 'Revoke user refresh sessions.',
  },
  {
    code: 'roles.read',
    resource: 'roles',
    action: 'read',
    description: 'View roles and their permissions.',
  },
  {
    code: 'roles.assign',
    resource: 'roles',
    action: 'assign',
    description: 'Assign and revoke user roles.',
  },
  {
    code: 'permissions.read',
    resource: 'permissions',
    action: 'read',
    description: 'View the permission catalog.',
  },
  {
    code: 'audit.read',
    resource: 'audit',
    action: 'read',
    description: 'View permitted identity and access audit records.',
  },
  {
    code: 'courses.read',
    resource: 'courses',
    action: 'read',
    description: 'View permitted course administration records.',
  },
  {
    code: 'courses.create',
    resource: 'courses',
    action: 'create',
    description: 'Create courses within the permitted scope.',
  },
  {
    code: 'courses.update',
    resource: 'courses',
    action: 'update',
    description: 'Update courses within the permitted scope.',
  },
  {
    code: 'courses.delete',
    resource: 'courses',
    action: 'delete',
    description: 'Soft-delete courses within the permitted scope.',
  },
  {
    code: 'courses.restore',
    resource: 'courses',
    action: 'restore',
    description: 'Restore soft-deleted courses within the permitted scope.',
  },
  {
    code: 'courses.submit_review',
    resource: 'courses',
    action: 'submit_review',
    description: 'Submit an assigned course for editorial review.',
  },
  {
    code: 'courses.publish',
    resource: 'courses',
    action: 'publish',
    description: 'Publish and archive courses.',
  },
  {
    code: 'courses.assign_teacher',
    resource: 'courses',
    action: 'assign_teacher',
    description: 'Assign or remove a course teacher.',
  },
  {
    code: 'courses.view_statistics',
    resource: 'courses',
    action: 'view_statistics',
    description: 'View platform-wide course statistics.',
  },
  {
    code: 'sections.read',
    resource: 'sections',
    action: 'read',
    description: 'View sections in permitted courses.',
  },
  {
    code: 'sections.create',
    resource: 'sections',
    action: 'create',
    description: 'Create sections in permitted courses.',
  },
  {
    code: 'sections.update',
    resource: 'sections',
    action: 'update',
    description: 'Update sections in permitted courses.',
  },
  {
    code: 'sections.delete',
    resource: 'sections',
    action: 'delete',
    description: 'Soft-delete empty sections in permitted courses.',
  },
  {
    code: 'sections.restore',
    resource: 'sections',
    action: 'restore',
    description: 'Restore sections in permitted courses.',
  },
  {
    code: 'sections.reorder',
    resource: 'sections',
    action: 'reorder',
    description: 'Reorder sections in permitted courses.',
  },
  {
    code: 'sections.publish',
    resource: 'sections',
    action: 'publish',
    description: 'Publish or unpublish course sections.',
  },
  {
    code: 'lessons.read',
    resource: 'lessons',
    action: 'read',
    description: 'View lessons in permitted courses.',
  },
  {
    code: 'lessons.create',
    resource: 'lessons',
    action: 'create',
    description: 'Create lessons in permitted courses.',
  },
  {
    code: 'lessons.update',
    resource: 'lessons',
    action: 'update',
    description: 'Update lessons in permitted courses.',
  },
  {
    code: 'lessons.delete',
    resource: 'lessons',
    action: 'delete',
    description: 'Soft-delete lessons in permitted courses.',
  },
  {
    code: 'lessons.restore',
    resource: 'lessons',
    action: 'restore',
    description: 'Restore lessons in permitted courses.',
  },
  {
    code: 'lessons.reorder',
    resource: 'lessons',
    action: 'reorder',
    description: 'Reorder or move lessons in permitted courses.',
  },
  {
    code: 'lessons.submit_review',
    resource: 'lessons',
    action: 'submit_review',
    description: 'Submit lessons for editorial review.',
  },
  {
    code: 'lessons.publish',
    resource: 'lessons',
    action: 'publish',
    description: 'Publish and archive lessons.',
  },
  {
    code: 'lessons.assign_teacher',
    resource: 'lessons',
    action: 'assign_teacher',
    description: 'Assign or remove a lesson teacher.',
  },
  {
    code: 'lessons.view_statistics',
    resource: 'lessons',
    action: 'view_statistics',
    description: 'View lesson statistics for permitted courses.',
  },
  {
    code: 'lesson_blocks.read',
    resource: 'lesson_blocks',
    action: 'read',
    description: 'View content blocks in permitted lessons.',
  },
  {
    code: 'lesson_blocks.create',
    resource: 'lesson_blocks',
    action: 'create',
    description: 'Create content blocks in permitted lessons.',
  },
  {
    code: 'lesson_blocks.update',
    resource: 'lesson_blocks',
    action: 'update',
    description: 'Update content blocks in permitted lessons.',
  },
  {
    code: 'lesson_blocks.delete',
    resource: 'lesson_blocks',
    action: 'delete',
    description: 'Soft-delete content blocks in permitted lessons.',
  },
  {
    code: 'lesson_blocks.restore',
    resource: 'lesson_blocks',
    action: 'restore',
    description: 'Restore content blocks in permitted lessons.',
  },
  {
    code: 'lesson_blocks.reorder',
    resource: 'lesson_blocks',
    action: 'reorder',
    description: 'Reorder content blocks in permitted lessons.',
  },
  {
    code: 'lesson_blocks.manage_visibility',
    resource: 'lesson_blocks',
    action: 'manage_visibility',
    description: 'Show or hide content blocks in permitted lessons.',
  },
  {
    code: 'media.upload',
    resource: 'media',
    action: 'upload',
    description: 'Upload validated media files.',
  },
  {
    code: 'media.read',
    resource: 'media',
    action: 'read',
    description: 'View permitted media file metadata.',
  },
  {
    code: 'media.download',
    resource: 'media',
    action: 'download',
    description: 'Download permitted active media files.',
  },
  {
    code: 'media.delete',
    resource: 'media',
    action: 'delete',
    description: 'Soft-delete permitted media files.',
  },
  {
    code: 'media.restore',
    resource: 'media',
    action: 'restore',
    description: 'Restore permitted soft-deleted media files.',
  },
  {
    code: 'enrollments.self_create',
    resource: 'enrollments',
    action: 'self_create',
    description: 'Enroll the current student in an available course.',
  },
  {
    code: 'enrollments.self_read',
    resource: 'enrollments',
    action: 'self_read',
    description: 'View the current student enrollment records.',
  },
  {
    code: 'enrollments.self_cancel',
    resource: 'enrollments',
    action: 'self_cancel',
    description: 'Cancel the current student active enrollment.',
  },
  {
    code: 'enrollments.create',
    resource: 'enrollments',
    action: 'create',
    description: 'Enroll an eligible student within the permitted course scope.',
  },
  {
    code: 'enrollments.read',
    resource: 'enrollments',
    action: 'read',
    description: 'View enrollment records within the permitted course scope.',
  },
  {
    code: 'enrollments.update_status',
    resource: 'enrollments',
    action: 'update_status',
    description: 'Manage enrollment lifecycle status within the permitted course scope.',
  },
  {
    code: 'progress.self_read',
    resource: 'progress',
    action: 'self_read',
    description: 'View the current student enrollment-scoped progress.',
  },
  {
    code: 'progress.self_complete',
    resource: 'progress',
    action: 'self_complete',
    description: 'Complete eligible blocks and lessons in the current student enrollment.',
  },
  {
    code: 'progress.self_reopen',
    resource: 'progress',
    action: 'self_reopen',
    description: 'Reopen eligible progress in the current active student enrollment.',
  },
  {
    code: 'progress.self_record_visit',
    resource: 'progress',
    action: 'self_record_visit',
    description: 'Record the current student last-visited eligible lesson.',
  },
  {
    code: 'progress.course.read',
    resource: 'progress.course',
    action: 'read',
    description: 'View progress within the currently assigned teacher course scope.',
  },
  {
    code: 'progress.read',
    resource: 'progress',
    action: 'read',
    description: 'View permission-scoped progress administration records.',
  },
  {
    code: 'progress.export',
    resource: 'progress',
    action: 'export',
    description: 'Authorize a future approved, step-up-protected progress export.',
  },
  {
    code: 'certificate_eligibility.self_read',
    resource: 'certificate_eligibility',
    action: 'self_read',
    description: 'View certificate eligibility for the current student enrollment.',
  },
  {
    code: 'certificate_eligibility.course_read',
    resource: 'certificate_eligibility',
    action: 'course_read',
    description: 'View certificate eligibility within an assigned or permitted course.',
  },
  {
    code: 'certificates.self_read',
    resource: 'certificates',
    action: 'self_read',
    description: 'View certificate status for the current student enrollment.',
  },
  {
    code: 'certificates.course_read',
    resource: 'certificates',
    action: 'course_read',
    description: 'View certificate status within an assigned or permitted course.',
  },
  {
    code: 'certificates.issue',
    resource: 'certificates',
    action: 'issue',
    description: 'Authorize future step-up-protected certificate issuance.',
  },
  {
    code: 'certificates.revoke',
    resource: 'certificates',
    action: 'revoke',
    description: 'Authorize future step-up-protected certificate revocation.',
  },
] as const;

const teacherPermissionCodes = [
  'courses.read',
  'courses.create',
  'courses.update',
  'courses.delete',
  'courses.restore',
  'courses.submit_review',
  'sections.read',
  'sections.create',
  'sections.update',
  'sections.delete',
  'sections.restore',
  'sections.reorder',
  'lessons.read',
  'lessons.create',
  'lessons.update',
  'lessons.delete',
  'lessons.restore',
  'lessons.reorder',
  'lessons.submit_review',
  'lessons.view_statistics',
  'lesson_blocks.read',
  'lesson_blocks.create',
  'lesson_blocks.update',
  'lesson_blocks.delete',
  'lesson_blocks.restore',
  'lesson_blocks.reorder',
  'lesson_blocks.manage_visibility',
  'media.upload',
  'media.read',
  'media.download',
  'media.delete',
  'media.restore',
  'enrollments.create',
  'enrollments.read',
  'enrollments.update_status',
  'progress.course.read',
  'certificate_eligibility.course_read',
  'certificates.course_read',
] as const;

const studentPermissionCodes = [
  'enrollments.self_create',
  'enrollments.self_read',
  'enrollments.self_cancel',
  'progress.self_read',
  'progress.self_complete',
  'progress.self_reopen',
  'progress.self_record_visit',
  'certificate_eligibility.self_read',
  'certificates.self_read',
] as const;

async function seedCertificateEligibilityPolicy(): Promise<void> {
  const existing = await prisma.certificateEligibilityPolicy.findUnique({
    where: {
      code_version: {
        code: certificateEligibilityPolicyDefinition.code,
        version: certificateEligibilityPolicyDefinition.version,
      },
    },
  });

  if (!existing) {
    await prisma.certificateEligibilityPolicy.create({
      data: certificateEligibilityPolicyDefinition,
    });
    return;
  }

  const matchesApprovedV1Policy =
    existing.assessmentRule === certificateEligibilityPolicyDefinition.assessmentRule &&
    existing.requiresAttendance === certificateEligibilityPolicyDefinition.requiresAttendance &&
    existing.requiresManualApproval ===
      certificateEligibilityPolicyDefinition.requiresManualApproval;

  if (!matchesApprovedV1Policy) {
    throw new Error(
      'Certificate eligibility v1 policy does not match the approved immutable definition.',
    );
  }
}

async function seedDevelopmentUsers(roles: Role[]): Promise<void> {
  if (!seedConfiguration.SEED_DEVELOPMENT_USERS) {
    console.info(
      'Development foydalanuvchilari yaratilmadi. Yaratish uchun SEED_DEVELOPMENT_USERS=true qiymatini aniq belgilang.',
    );
    return;
  }

  if (seedConfiguration.NODE_ENV === 'production') {
    throw new Error(
      'SEED_DEVELOPMENT_USERS=true production muhitida taqiqlangan. Development hisoblari yaratilmadi.',
    );
  }

  const passwordService = new BcryptPasswordService(seedConfiguration.BCRYPT_ROUNDS);
  const rolesByCode = new Map(roles.map((role) => [role.code, role]));

  for (const definition of developmentUserDefinitions) {
    const role = rolesByCode.get(definition.role);

    if (!role) {
      throw new Error(`${definition.role} roli development foydalanuvchisi uchun topilmadi.`);
    }

    const passwordHash = await passwordService.hash(definition.password);
    const now = new Date();

    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        where: { email: definition.email },
        update: {
          firstName: definition.firstName,
          lastName: definition.lastName,
          displayName: definition.displayName,
          status: UserStatus.ACTIVE,
          deletedAt: null,
          credential: {
            upsert: {
              create: {
                passwordHash,
                requiresPasswordChange: false,
              },
              update: {
                passwordHash,
                failedLoginCount: 0,
                lockedUntil: null,
                passwordChangedAt: now,
                requiresPasswordChange: false,
                passwordResetTokenHash: null,
                passwordResetExpiresAt: null,
              },
            },
          },
        },
        create: {
          email: definition.email,
          firstName: definition.firstName,
          lastName: definition.lastName,
          displayName: definition.displayName,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
          credential: {
            create: {
              passwordHash,
              requiresPasswordChange: false,
            },
          },
        },
        select: { id: true },
      });

      await transaction.user.updateMany({
        where: { id: user.id, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      await transaction.userRole.deleteMany({
        where: {
          userId: user.id,
          roleId: { not: role.id },
        },
      });
      await transaction.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {
          assignedByUserId: null,
          expiresAt: null,
        },
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });
      await transaction.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: 'Development seed credential reset.',
        },
      });
    });
  }

  console.info('Development login foydalanuvchilari tayyorlandi.');
}

async function assertProductionSeedSafety(): Promise<void> {
  if (seedConfiguration.NODE_ENV !== 'production') return;

  if (seedConfiguration.SEED_DEVELOPMENT_USERS) {
    throw new Error(
      'SEED_DEVELOPMENT_USERS=true production muhitida taqiqlangan. Development hisoblari yaratilmadi.',
    );
  }

  const knownDevelopmentUsers = await prisma.user.findMany({
    where: {
      email: { in: developmentUserDefinitions.map((definition) => definition.email) },
    },
    select: { email: true },
    orderBy: { email: 'asc' },
  });

  if (knownDevelopmentUsers.length > 0) {
    const identities = knownDevelopmentUsers.map((user) => user.email).join(', ');
    throw new Error(
      `Production xavfsizlik tekshiruvi muvaffaqiyatsiz: ma’lum development hisoblari topildi: ${identities}. Seed ma’lumotlarni o‘zgartirmadi; deploymentni to‘xtating va hisoblarni xavfsiz boshqaruv jarayoni orqali tekshiring.`,
    );
  }
}

async function seedIdentityAndAccess(): Promise<void> {
  await assertProductionSeedSafety();

  const roles = await prisma.$transaction(
    roleDefinitions.map((role) =>
      prisma.role.upsert({
        where: { code: role.code },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
        },
        create: {
          ...role,
          isSystem: true,
        },
      }),
    ),
  );

  const permissions = await prisma.$transaction(
    permissionDefinitions.map((permission) =>
      prisma.permission.upsert({
        where: { code: permission.code },
        update: {
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
        },
        create: permission,
      }),
    ),
  );

  const adminRole = roles.find((role) => role.code === RoleCode.ADMIN);
  const teacherRole = roles.find((role) => role.code === RoleCode.TEACHER);
  const studentRole = roles.find((role) => role.code === RoleCode.STUDENT);

  if (!adminRole || !teacherRole || !studentRole) {
    throw new Error('The ADMIN, TEACHER, or STUDENT role could not be created.');
  }

  const adminAssignments = permissions.map((permission) =>
    prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    }),
  );
  const teacherAssignments = permissions
    .filter((permission) =>
      teacherPermissionCodes.includes(permission.code as (typeof teacherPermissionCodes)[number]),
    )
    .map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: teacherRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: teacherRole.id,
          permissionId: permission.id,
        },
      }),
    );
  const studentAssignments = permissions
    .filter((permission) =>
      studentPermissionCodes.includes(permission.code as (typeof studentPermissionCodes)[number]),
    )
    .map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: studentRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: studentRole.id,
          permissionId: permission.id,
        },
      }),
    );

  await prisma.$transaction([...adminAssignments, ...teacherAssignments, ...studentAssignments]);
  await seedCertificateEligibilityPolicy();
  await seedDevelopmentUsers(roles);
}

try {
  await seedIdentityAndAccess();
  console.info('Identity and access seed completed successfully.');
} catch (error: unknown) {
  console.error('Identity and access seed failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
