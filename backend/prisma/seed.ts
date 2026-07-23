import { PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

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
] as const;

async function seedIdentityAndAccess(): Promise<void> {
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

  if (!adminRole) {
    throw new Error('The ADMIN role could not be created.');
  }

  await prisma.$transaction(
    permissions.map((permission) =>
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
    ),
  );
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
