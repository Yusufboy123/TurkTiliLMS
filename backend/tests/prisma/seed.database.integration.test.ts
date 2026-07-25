import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
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
