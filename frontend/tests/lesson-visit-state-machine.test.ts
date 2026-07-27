import { describe, expect, it, vi } from 'vitest';
import { createLessonVisitStateMachine } from '../src/features/progress/lesson-visit-state-machine';

const enrollmentId = '019c0000-0000-7000-8000-000000000001';
const lessonAId = '019c0000-0000-7000-8000-000000000004';
const lessonBId = '019c0000-0000-7000-8000-000000000006';
const allowedOnline = { canRecordActivity: true, isOnline: true };

function createKeyFactory() {
  let sequence = 0;
  return () => `lesson-visit-key-${++sequence}`;
}

function selectLesson(
  stateMachine: ReturnType<typeof createLessonVisitStateMachine>,
  lessonId: string,
) {
  stateMachine.selectLesson({
    enrollmentId,
    lessonId,
    curriculumVersion: 3,
  });
}

describe('lesson visit idempotency lifecycle', () => {
  it('gives lesson B a different key after navigation from lesson A', () => {
    const stateMachine = createLessonVisitStateMachine(createKeyFactory());

    selectLesson(stateMachine, lessonAId);
    const lessonAKey = stateMachine.getSnapshot().operation?.idempotencyKey;
    selectLesson(stateMachine, lessonBId);
    const lessonBKey = stateMachine.getSnapshot().operation?.idempotencyKey;

    expect(lessonAKey).toBe('lesson-visit-key-1');
    expect(lessonBKey).toBe('lesson-visit-key-2');
    expect(lessonBKey).not.toBe(lessonAKey);
    expect(stateMachine.getSnapshot().status).toBe('IDLE');
  });

  it('reuses lesson A key when the same failed logical visit is retried', async () => {
    const stateMachine = createLessonVisitStateMachine(createKeyFactory());
    const keys: string[] = [];
    selectLesson(stateMachine, lessonAId);

    await expect(
      stateMachine.attempt(allowedOnline, async (operation) => {
        keys.push(operation.idempotencyKey);
        throw new Error('network failure');
      }),
    ).rejects.toThrow('network failure');

    await stateMachine.attempt(allowedOnline, async (operation) => {
      keys.push(operation.idempotencyKey);
    });

    expect(keys).toEqual(['lesson-visit-key-1', 'lesson-visit-key-1']);
    expect(stateMachine.getSnapshot().status).toBe('RECORDED');
  });
});

describe('lesson visit failure and concurrency state machine', () => {
  it.each([
    ['network failure', new TypeError('Failed to fetch')],
    ['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })],
    ['server error', Object.assign(new Error('server error'), { status: 500 })],
  ])('moves to FAILED after %s and permits a same-key retry', async (_label, failure) => {
    const stateMachine = createLessonVisitStateMachine(createKeyFactory());
    const keys: string[] = [];
    selectLesson(stateMachine, lessonAId);

    await expect(
      stateMachine.attempt(allowedOnline, async (operation) => {
        keys.push(operation.idempotencyKey);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(stateMachine.getSnapshot().status).toBe('FAILED');

    await stateMachine.attempt(allowedOnline, async (operation) => {
      keys.push(operation.idempotencyKey);
    });

    expect(keys).toEqual(['lesson-visit-key-1', 'lesson-visit-key-1']);
    expect(stateMachine.getSnapshot().status).toBe('RECORDED');
  });

  it('keeps an offline visit idle and records it after reconnect with the same key', async () => {
    const stateMachine = createLessonVisitStateMachine(createKeyFactory());
    const send = vi.fn(async () => undefined);
    selectLesson(stateMachine, lessonAId);
    const initialKey = stateMachine.getSnapshot().operation?.idempotencyKey;

    await expect(
      stateMachine.attempt({ canRecordActivity: true, isOnline: false }, send),
    ).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(stateMachine.getSnapshot().status).toBe('IDLE');

    await expect(stateMachine.attempt(allowedOnline, send)).resolves.toBe(true);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].idempotencyKey).toBe(initialKey);
    expect(stateMachine.getSnapshot().status).toBe('RECORDED');
  });

  it('prevents a duplicate request while the visit mutation is pending', async () => {
    const stateMachine = createLessonVisitStateMachine(createKeyFactory());
    let finishRequest = () => undefined;
    const pendingRequest = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const send = vi.fn(async () => pendingRequest);
    selectLesson(stateMachine, lessonAId);

    const firstAttempt = stateMachine.attempt(allowedOnline, send);
    expect(stateMachine.getSnapshot().status).toBe('PENDING');
    await expect(stateMachine.attempt(allowedOnline, send)).resolves.toBe(false);
    expect(send).toHaveBeenCalledOnce();

    finishRequest();
    await expect(firstAttempt).resolves.toBe(true);
    expect(stateMachine.getSnapshot().status).toBe('RECORDED');
  });

  it('does not let a completed request for lesson A overwrite lesson B state', async () => {
    const stateMachine = createLessonVisitStateMachine(createKeyFactory());
    let finishLessonA = () => undefined;
    const lessonARequest = new Promise<void>((resolve) => {
      finishLessonA = resolve;
    });
    selectLesson(stateMachine, lessonAId);
    const firstAttempt = stateMachine.attempt(allowedOnline, async () => lessonARequest);

    selectLesson(stateMachine, lessonBId);
    expect(stateMachine.getSnapshot()).toMatchObject({
      operation: {
        idempotencyKey: 'lesson-visit-key-2',
        lessonId: lessonBId,
      },
      status: 'IDLE',
    });

    finishLessonA();
    await firstAttempt;

    expect(stateMachine.getSnapshot()).toMatchObject({
      operation: {
        idempotencyKey: 'lesson-visit-key-2',
        lessonId: lessonBId,
      },
      status: 'IDLE',
    });
  });
});
