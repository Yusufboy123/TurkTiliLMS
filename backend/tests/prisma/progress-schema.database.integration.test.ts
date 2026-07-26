import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  BlockProgressState,
  CourseEnrollmentSource,
  CourseLevel,
  CourseStatus,
  IdempotencyOperation,
  LessonContentBlockType,
  LessonProgressState,
  LessonStatus,
  LessonType,
  Prisma,
  PrismaClient,
  ProgressEventState,
  ProgressEventType,
} from '@prisma/client';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(backendRoot, '..');
const prismaCliPath = resolve(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');
const rollbackScriptPath = resolve(
  backendRoot,
  'prisma',
  'migrations',
  '20260726190508_add_progress_tracking_schema',
  'rollback.sql',
);

const expectedTables = [
  'block_progress',
  'enrollment_progress_roots',
  'idempotency_records',
  'lesson_progress',
  'progress_events',
] as const;

const expectedCheckConstraints = [
  'block_progress_curriculum_version_positive_check',
  'block_progress_state_completion_check',
  'courses_curriculum_version_positive_check',
  'enrollment_progress_roots_activity_timestamps_check',
  'enrollment_progress_roots_counts_check',
  'enrollment_progress_roots_last_visited_pair_check',
  'enrollment_progress_roots_percentage_check',
  'enrollment_progress_roots_versions_check',
  'idempotency_records_expiry_check',
  'idempotency_records_fingerprint_check',
  'idempotency_records_key_check',
  'idempotency_records_response_status_check',
  'idempotency_records_result_versions_check',
  'lesson_progress_curriculum_version_positive_check',
  'lesson_progress_state_completion_check',
  'lesson_progress_timestamps_check',
  'progress_events_shape_check',
  'progress_events_snapshot_check',
  'progress_events_transition_check',
  'progress_events_versions_check',
] as const;

const expectedIndexes = [
  'block_progress_block_id_state_idx',
  'block_progress_completed_at_idx',
  'block_progress_enrollment_id_block_id_key',
  'block_progress_enrollment_id_state_block_id_idx',
  'block_progress_pkey',
  'enrollment_progress_roots_enrollment_id_key',
  'enrollment_progress_roots_frozen_at_idx',
  'enrollment_progress_roots_last_visited_at_enrollment_id_idx',
  'enrollment_progress_roots_pkey',
  'idempotency_records_actor_user_id_key_key',
  'idempotency_records_enrollment_id_created_at_idx',
  'idempotency_records_expires_at_idx',
  'idempotency_records_operation_created_at_idx',
  'idempotency_records_pkey',
  'lesson_progress_completed_at_idx',
  'lesson_progress_enrollment_id_last_activity_at_idx',
  'lesson_progress_enrollment_id_lesson_id_key',
  'lesson_progress_enrollment_id_state_lesson_id_idx',
  'lesson_progress_lesson_id_state_idx',
  'lesson_progress_pkey',
  'progress_events_actor_user_id_occurred_at_idx',
  'progress_events_block_id_occurred_at_idx',
  'progress_events_enrollment_id_occurred_at_idx',
  'progress_events_event_type_occurred_at_idx',
  'progress_events_idempotency_record_id_idx',
  'progress_events_lesson_id_occurred_at_idx',
  'progress_events_pkey',
] as const;

function randomSchemaSuffix(): string {
  return randomUUID().replaceAll('-', '');
}

function isConstraintError(error: unknown, constraintName: string): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(constraintName) ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2004' &&
        String(error.meta?.database_error).includes(constraintName)))
  );
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

describeDatabase('Module 8.1B progress schema PostgreSQL integration', () => {
  const administrationClient = new PrismaClient({
    ...(testDatabaseUrl ? { datasourceUrl: testDatabaseUrl } : {}),
  });
  const schemaName = `progress_schema_test_${randomSchemaSuffix()}`;
  let isolatedDatabaseUrl = '';
  let client: PrismaClient;
  let clientDisconnected = false;
  let studentId = '';
  let courseId = '';
  let enrollmentId = '';
  let lessonId = '';
  let blockId = '';

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    if (!/^progress_schema_test_[a-f0-9]{32}$/u.test(schemaName)) {
      throw new Error('Generated test schema name is invalid.');
    }

    const url = new URL(testDatabaseUrl);
    url.searchParams.set('schema', schemaName);
    isolatedDatabaseUrl = url.toString();

    await administrationClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    await administrationClient.$executeRawUnsafe(
      `CREATE DOMAIN "${schemaName}"."citext" AS public.citext`,
    );
    await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
      windowsHide: true,
    });

    client = new PrismaClient({ datasourceUrl: isolatedDatabaseUrl });

    const admin = await client.user.create({
      data: { email: `progress-admin-${randomUUID()}@example.com` },
    });
    const student = await client.user.create({
      data: { email: `progress-student-${randomUUID()}@example.com` },
    });
    studentId = student.id;
    const course = await client.course.create({
      data: {
        title: 'Progress schema test',
        slug: `progress-schema-${randomUUID()}`,
        level: CourseLevel.A1,
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId: admin.id,
      },
    });
    courseId = course.id;
    const section = await client.courseSection.create({
      data: {
        courseId: course.id,
        title: 'Progress section',
        position: 1,
        isPublished: true,
        createdById: admin.id,
      },
    });
    const lesson = await client.lesson.create({
      data: {
        courseId: course.id,
        sectionId: section.id,
        title: 'Progress lesson',
        slug: `progress-lesson-${randomUUID()}`,
        lessonType: LessonType.TEXT,
        position: 1,
        status: LessonStatus.PUBLISHED,
        publishedAt: new Date(),
        createdById: admin.id,
      },
    });
    lessonId = lesson.id;
    const block = await client.lessonContentBlock.create({
      data: {
        lessonId: lesson.id,
        blockType: LessonContentBlockType.TEXT,
        position: 1,
        isRequired: true,
        isVisible: true,
        textContent: 'Progress schema test content',
        createdById: admin.id,
      },
    });
    blockId = block.id;
    const enrollment = await client.courseEnrollment.create({
      data: {
        courseId: course.id,
        studentId: student.id,
        source: CourseEnrollmentSource.SELF,
      },
    });
    enrollmentId = enrollment.id;
  }, 60_000);

  afterAll(async () => {
    if (!clientDisconnected) await client?.$disconnect();
    if (/^progress_schema_test_[a-f0-9]{32}$/u.test(schemaName)) {
      await administrationClient.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    }
    await administrationClient.$disconnect();
  });

  it('applies all progress tables, enums, checks, indexes, and safe foreign keys', async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN (
          'enrollment_progress_roots',
          'lesson_progress',
          'block_progress',
          'progress_events',
          'idempotency_records'
        )
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual([...expectedTables]);

    const enumLabels = await client.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_catalog.pg_enum
      JOIN pg_catalog.pg_type ON pg_type.oid = pg_enum.enumtypid
      JOIN pg_catalog.pg_namespace ON pg_namespace.oid = pg_type.typnamespace
      WHERE pg_namespace.nspname = current_schema()
        AND pg_type.typname = 'block_progress_state'
      ORDER BY enumsortorder
    `;
    expect(enumLabels.map(({ enumlabel }) => enumlabel)).toEqual(['INCOMPLETE', 'COMPLETED']);

    const checks = await client.$queryRaw<Array<{ conname: string; convalidated: boolean }>>`
      SELECT conname, convalidated
      FROM pg_catalog.pg_constraint
      WHERE connamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema()
      )
        AND contype = 'c'
        AND conname = ANY(${expectedCheckConstraints})
      ORDER BY conname
    `;
    expect(checks.map(({ conname }) => conname)).toEqual([...expectedCheckConstraints]);
    expect(checks.every(({ convalidated }) => convalidated)).toBe(true);

    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_catalog.pg_indexes
      WHERE schemaname = current_schema()
        AND tablename IN (
          'enrollment_progress_roots',
          'lesson_progress',
          'block_progress',
          'progress_events',
          'idempotency_records'
        )
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual([...expectedIndexes]);

    const foreignKeys = await client.$queryRaw<Array<{ conname: string; confdeltype: string }>>`
      SELECT conname, confdeltype::TEXT
      FROM pg_catalog.pg_constraint
      WHERE connamespace = (
        SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = current_schema()
      )
        AND contype = 'f'
        AND conrelid IN (
          'enrollment_progress_roots'::REGCLASS,
          'lesson_progress'::REGCLASS,
          'block_progress'::REGCLASS,
          'progress_events'::REGCLASS,
          'idempotency_records'::REGCLASS
        )
    `;
    expect(foreignKeys).toHaveLength(13);
    const setNullForeignKeys = foreignKeys
      .filter(({ confdeltype }) => confdeltype === 'n')
      .map(({ conname }) => conname)
      .sort();
    expect(setNullForeignKeys).toEqual([
      'progress_events_actor_user_id_fkey',
      'progress_events_idempotency_record_id_fkey',
    ]);
    expect(
      foreignKeys
        .filter(({ confdeltype }) => confdeltype !== 'n')
        .every(({ confdeltype }) => {
          return confdeltype === 'r';
        }),
    ).toBe(true);

    await expect(
      client.course.findUniqueOrThrow({ where: { id: courseId } }),
    ).resolves.toMatchObject({ curriculumVersion: 1 });
  });

  it('enforces aggregate, state, timestamp, and curriculum checks', async () => {
    await expect(
      client.course.update({ where: { id: courseId }, data: { curriculumVersion: 0 } }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'courses_curriculum_version_positive_check'),
    );

    await expect(
      client.enrollmentProgressRoot.create({
        data: {
          enrollmentId,
          curriculumVersion: 1,
          completedLessons: 1,
          totalEligibleLessons: 2,
          coursePercentage: 60,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'enrollment_progress_roots_percentage_check'),
    );

    await client.enrollmentProgressRoot.create({
      data: {
        enrollmentId,
        curriculumVersion: 1,
      },
    });

    await expect(
      client.lessonProgress.create({
        data: {
          enrollmentId,
          lessonId,
          state: LessonProgressState.COMPLETED,
          curriculumVersion: 1,
          completedAt: null,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'lesson_progress_state_completion_check'),
    );

    await expect(
      client.blockProgress.create({
        data: {
          enrollmentId,
          blockId,
          state: BlockProgressState.INCOMPLETE,
          curriculumVersion: 1,
          completedAt: new Date(),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'block_progress_state_completion_check'),
    );
  });

  it('preserves sparse NOT_STARTED state and enforces enrollment-scoped uniqueness', async () => {
    await expect(client.blockProgress.count({ where: { enrollmentId, blockId } })).resolves.toBe(0);

    const activityAt = new Date();
    await client.lessonProgress.create({
      data: {
        enrollmentId,
        lessonId,
        state: LessonProgressState.IN_PROGRESS,
        curriculumVersion: 1,
        firstActivityAt: activityAt,
        lastActivityAt: activityAt,
      },
    });
    await client.blockProgress.create({
      data: {
        enrollmentId,
        blockId,
        state: BlockProgressState.COMPLETED,
        curriculumVersion: 1,
        completedAt: activityAt,
      },
    });

    await expect(
      client.enrollmentProgressRoot.create({
        data: { enrollmentId, curriculumVersion: 1 },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));
    await expect(
      client.lessonProgress.create({
        data: {
          enrollmentId,
          lessonId,
          state: LessonProgressState.IN_PROGRESS,
          curriculumVersion: 1,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));
    await expect(
      client.blockProgress.create({
        data: {
          enrollmentId,
          blockId,
          state: BlockProgressState.COMPLETED,
          curriculumVersion: 1,
          completedAt: activityAt,
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));
  });

  it('enforces foreign keys and fixed idempotency/event shapes', async () => {
    await expect(
      client.blockProgress.create({
        data: {
          enrollmentId,
          blockId: randomUUID(),
          state: BlockProgressState.COMPLETED,
          curriculumVersion: 1,
          completedAt: new Date(),
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2003'));

    await expect(
      client.idempotencyRecord.create({
        data: {
          actorUserId: studentId,
          enrollmentId,
          key: 'short',
          operation: IdempotencyOperation.COMPLETE_BLOCK,
          requestFingerprint: 'a'.repeat(64),
          responseStatus: 200,
          responseEnvelope: { success: true },
          resultingCompletionVersion: 1,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'idempotency_records_key_check'),
    );

    const idempotencyRecord = await client.idempotencyRecord.create({
      data: {
        actorUserId: studentId,
        enrollmentId,
        key: 'progress-test-key-0001',
        operation: IdempotencyOperation.COMPLETE_BLOCK,
        requestFingerprint: 'a'.repeat(64),
        responseStatus: 200,
        responseEnvelope: { success: true, data: { changed: true } },
        resultingCompletionVersion: 1,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await expect(
      client.idempotencyRecord.create({
        data: {
          actorUserId: studentId,
          enrollmentId,
          key: idempotencyRecord.key,
          operation: IdempotencyOperation.COMPLETE_BLOCK,
          requestFingerprint: 'b'.repeat(64),
          responseStatus: 200,
          responseEnvelope: { success: true },
          resultingCompletionVersion: 1,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    ).rejects.toSatisfy((error: unknown) => isPrismaError(error, 'P2002'));

    await expect(
      client.progressEvent.create({
        data: {
          enrollmentId,
          actorUserId: studentId,
          eventType: ProgressEventType.BLOCK_COMPLETED,
          lessonId,
          blockId: null,
          previousState: ProgressEventState.NOT_STARTED,
          newState: ProgressEventState.COMPLETED,
          curriculumVersion: 1,
          resultingCompletionVersion: 1,
          idempotencyRecordId: idempotencyRecord.id,
        },
      }),
    ).rejects.toSatisfy((error: unknown) =>
      isConstraintError(error, 'progress_events_shape_check'),
    );

    const event = await client.progressEvent.create({
      data: {
        enrollmentId,
        actorUserId: studentId,
        eventType: ProgressEventType.BLOCK_COMPLETED,
        lessonId,
        blockId,
        previousState: ProgressEventState.NOT_STARTED,
        newState: ProgressEventState.COMPLETED,
        curriculumVersion: 1,
        resultingCompletionVersion: 1,
        idempotencyRecordId: idempotencyRecord.id,
      },
    });
    expect(event).toMatchObject({
      eventType: ProgressEventType.BLOCK_COMPLETED,
      previousState: ProgressEventState.NOT_STARTED,
      newState: ProgressEventState.COMPLETED,
    });

    await client.idempotencyRecord.delete({ where: { id: idempotencyRecord.id } });
    await expect(
      client.progressEvent.findUniqueOrThrow({ where: { id: event.id } }),
    ).resolves.toMatchObject({ idempotencyRecordId: null });
  });

  it('rolls back only the additive Module 8.1B objects in an isolated schema', async () => {
    await client.$disconnect();
    clientDisconnected = true;

    await execFileAsync(
      process.execPath,
      [prismaCliPath, 'db', 'execute', '--file', rollbackScriptPath, '--url', isolatedDatabaseUrl],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
        windowsHide: true,
      },
    );

    const remainingProgressTables = await administrationClient.$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name IN (
            'enrollment_progress_roots',
            'lesson_progress',
            'block_progress',
            'progress_events',
            'idempotency_records'
          )
      `,
      schemaName,
    );
    expect(remainingProgressTables).toEqual([]);

    const existingCourseTable = await administrationClient.$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = 'courses'
      `,
      schemaName,
    );
    expect(existingCourseTable).toEqual([{ table_name: 'courses' }]);

    const curriculumColumns = await administrationClient.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'courses'
          AND column_name = 'curriculum_version'
      `,
      schemaName,
    );
    expect(curriculumColumns).toEqual([]);
  });
});
