import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  CertificateEligibilityAssessmentRule,
  CertificateEligibilityPolicyCode,
  PrismaClient,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const tsxCliPath = resolve(workspaceRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');
const seedScriptPath = resolve(backendRoot, 'prisma', 'seed.ts');

const expectedAccounts = [
  {
    email: 'admin@turktili.local',
    password: 'Admin123!',
    role: RoleCode.ADMIN,
  },
  {
    email: 'teacher@turktili.local',
    password: 'Teacher123!',
    role: RoleCode.TEACHER,
  },
  {
    email: 'student@turktili.local',
    password: 'Student123!',
    role: RoleCode.STUDENT,
  },
] as const;
const knownEmails = expectedAccounts.map((account) => account.email);
const expectedProgressPermissions = {
  [RoleCode.ADMIN]: [
    'progress.course.read',
    'progress.export',
    'progress.read',
    'progress.self_complete',
    'progress.self_read',
    'progress.self_record_visit',
    'progress.self_reopen',
  ],
  [RoleCode.TEACHER]: ['progress.course.read'],
  [RoleCode.STUDENT]: [
    'progress.self_complete',
    'progress.self_read',
    'progress.self_record_visit',
    'progress.self_reopen',
  ],
} as const;
const expectedCertificatePermissions = {
  [RoleCode.ADMIN]: [
    'certificate_eligibility.course_read',
    'certificate_eligibility.self_read',
    'certificates.course_read',
    'certificates.download',
    'certificates.issue',
    'certificates.revoke',
    'certificates.self_download',
    'certificates.self_read',
  ],
  [RoleCode.TEACHER]: ['certificate_eligibility.course_read', 'certificates.course_read'],
  [RoleCode.STUDENT]: [
    'certificate_eligibility.self_read',
    'certificates.self_download',
    'certificates.self_read',
  ],
} as const;

describeDatabase('development user seed PostgreSQL integration', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `seed_test_${randomSchemaSuffix()}`;
  let isolatedDatabaseUrl = '';
  let client: PrismaClient;

  function randomSchemaSuffix(): string {
    return randomUUID().replaceAll('-', '');
  }

  function seedEnvironment(
    nodeEnvironment: 'development' | 'test' | 'production',
    seedDevelopmentUsers: boolean,
  ): NodeJS.ProcessEnv {
    return {
      ...process.env,
      DATABASE_URL: isolatedDatabaseUrl,
      NODE_ENV: nodeEnvironment,
      BCRYPT_ROUNDS: '10',
      SEED_DEVELOPMENT_USERS: seedDevelopmentUsers ? 'true' : 'false',
    };
  }

  async function runSeed(
    nodeEnvironment: 'development' | 'test' | 'production',
    seedDevelopmentUsers: boolean,
  ): Promise<void> {
    await execFileAsync(process.execPath, [tsxCliPath, seedScriptPath], {
      cwd: backendRoot,
      env: seedEnvironment(nodeEnvironment, seedDevelopmentUsers),
      windowsHide: true,
    });
  }

  async function removeKnownDevelopmentUsers(): Promise<void> {
    await client.user.deleteMany({ where: { email: { in: knownEmails } } });
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^seed_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated test schema name is invalid.');
    }

    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    isolatedDatabaseUrl = url.toString();
    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    // The shared test database owns the citext extension in public. A temporary
    // domain makes the extension type visible to migrations whose search_path
    // is intentionally restricted to this isolated schema.
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${schemaName}"."citext" AS public.citext`,
    );
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
      windowsHide: true,
    });
    client = new PrismaClient({ datasourceUrl: isolatedDatabaseUrl });
  }, 30_000);

  afterEach(removeKnownDevelopmentUsers);

  afterAll(async () => {
    await client?.$disconnect();
    if (/^seed_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    await administrationClient.$disconnect();
  });

  it('does not create development users by default', async () => {
    await runSeed('test', false);
    await expect(client.user.count({ where: { email: { in: knownEmails } } })).resolves.toBe(0);
  });

  it('seeds approved progress permissions and role assignments idempotently', async () => {
    await runSeed('test', false);
    await runSeed('test', false);

    const roles = await client.role.findMany({
      where: { code: { in: [RoleCode.ADMIN, RoleCode.TEACHER, RoleCode.STUDENT] } },
      select: {
        code: true,
        permissions: {
          where: { permission: { code: { startsWith: 'progress.' } } },
          select: { permission: { select: { code: true } } },
        },
      },
      orderBy: { code: 'asc' },
    });

    expect(roles).toHaveLength(3);
    for (const role of roles) {
      expect(role.permissions.map(({ permission }) => permission.code).sort()).toEqual([
        ...expectedProgressPermissions[role.code],
      ]);
    }

    await expect(
      client.permission.count({ where: { code: { startsWith: 'progress.' } } }),
    ).resolves.toBe(7);
  });

  it('seeds certificate permissions and the immutable v1 policy idempotently', async () => {
    await runSeed('test', false);
    await runSeed('test', false);

    const roles = await client.role.findMany({
      where: { code: { in: [RoleCode.ADMIN, RoleCode.TEACHER, RoleCode.STUDENT] } },
      select: {
        code: true,
        permissions: {
          where: { permission: { code: { startsWith: 'certificate' } } },
          select: { permission: { select: { code: true } } },
        },
      },
      orderBy: { code: 'asc' },
    });

    expect(roles).toHaveLength(3);
    for (const role of roles) {
      expect(role.permissions.map(({ permission }) => permission.code).sort()).toEqual([
        ...expectedCertificatePermissions[role.code],
      ]);
    }

    await expect(
      client.permission.count({ where: { code: { startsWith: 'certificate' } } }),
    ).resolves.toBe(8);
    await expect(
      client.certificateEligibilityPolicy.findMany({
        select: {
          code: true,
          version: true,
          assessmentRule: true,
          requiresAttendance: true,
          requiresManualApproval: true,
        },
      }),
    ).resolves.toEqual([
      {
        code: CertificateEligibilityPolicyCode.COURSE_COMPLETION_ONLY,
        version: 1,
        assessmentRule: CertificateEligibilityAssessmentRule.NONE,
        requiresAttendance: false,
        requiresManualApproval: false,
      },
    ]);

    await expect(
      client.certificateTemplate.findMany({
        select: {
          code: true,
          name: true,
          versions: { select: { id: true } },
        },
      }),
    ).resolves.toEqual([
      {
        code: 'STANDARD_COURSE_COMPLETION',
        name: 'Standard Course Completion',
        versions: [],
      },
    ]);
  });

  it('creates opt-in development users idempotently with exactly the expected roles', async () => {
    await runSeed('test', true);
    await runSeed('test', true);

    for (const expected of expectedAccounts) {
      const users = await client.user.findMany({
        where: { email: expected.email },
        select: {
          status: true,
          deletedAt: true,
          emailVerifiedAt: true,
          credential: {
            select: {
              passwordHash: true,
              failedLoginCount: true,
              lockedUntil: true,
              requiresPasswordChange: true,
            },
          },
          roles: {
            select: {
              expiresAt: true,
              role: { select: { code: true } },
            },
          },
        },
      });

      expect(users).toHaveLength(1);
      const user = users[0];
      expect(user).toMatchObject({
        status: UserStatus.ACTIVE,
        deletedAt: null,
        credential: {
          failedLoginCount: 0,
          lockedUntil: null,
          requiresPasswordChange: false,
        },
      });
      expect(user?.emailVerifiedAt).not.toBeNull();
      expect(user?.roles).toEqual([
        {
          expiresAt: null,
          role: { code: expected.role },
        },
      ]);
      await expect(
        bcrypt.compare(expected.password, user?.credential?.passwordHash ?? ''),
      ).resolves.toBe(true);
    }
  });

  it('rejects the development-user opt-in flag in production', async () => {
    await expect(runSeed('production', true)).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'SEED_DEVELOPMENT_USERS=true production muhitida taqiqlangan',
      ),
    });
    await expect(client.user.count({ where: { email: { in: knownEmails } } })).resolves.toBe(0);
  });

  it('fails the production preflight when a known development identity exists', async () => {
    const existing = await client.user.create({
      data: {
        email: expectedAccounts[0].email,
        displayName: 'Existing known development identity',
      },
      select: { id: true, displayName: true },
    });

    await expect(runSeed('production', false)).rejects.toMatchObject({
      stderr: expect.stringContaining('ma’lum development hisoblari topildi'),
    });

    await expect(
      client.user.findUnique({
        where: { id: existing.id },
        select: { displayName: true },
      }),
    ).resolves.toEqual({ displayName: existing.displayName });
  });
});
