export type LessonVisitStatus = 'IDLE' | 'PENDING' | 'RECORDED' | 'FAILED';

export interface LessonVisitOperation {
  enrollmentId: string;
  lessonId: string;
  curriculumVersion: number;
  idempotencyKey: string;
}

export interface LessonVisitSelection {
  enrollmentId: string;
  lessonId: string;
  curriculumVersion: number;
}

export interface LessonVisitAttemptPolicy {
  canRecordActivity: boolean;
  isOnline: boolean;
}

export interface LessonVisitSnapshot {
  operation: LessonVisitOperation | null;
  status: LessonVisitStatus;
}

type LessonVisitSender = (operation: LessonVisitOperation) => Promise<unknown>;
type IdempotencyKeyFactory = () => string;

export interface LessonVisitStateMachine {
  attempt(policy: LessonVisitAttemptPolicy, send: LessonVisitSender): Promise<boolean>;
  getSnapshot(): LessonVisitSnapshot;
  selectLesson(selection: LessonVisitSelection): void;
}

function isSameLesson(operation: LessonVisitOperation, selection: LessonVisitSelection): boolean {
  return (
    operation.enrollmentId === selection.enrollmentId && operation.lessonId === selection.lessonId
  );
}

export function createLessonVisitStateMachine(
  createIdempotencyKey: IdempotencyKeyFactory,
): LessonVisitStateMachine {
  let snapshot: LessonVisitSnapshot = {
    operation: null,
    status: 'IDLE',
  };

  return {
    selectLesson(selection) {
      if (snapshot.operation && isSameLesson(snapshot.operation, selection)) {
        if (snapshot.status === 'IDLE') {
          snapshot = {
            ...snapshot,
            operation: {
              ...snapshot.operation,
              curriculumVersion: selection.curriculumVersion,
            },
          };
        }
        return;
      }

      snapshot = {
        operation: {
          ...selection,
          idempotencyKey: createIdempotencyKey(),
        },
        status: 'IDLE',
      };
    },

    async attempt(policy, send) {
      const operation = snapshot.operation;
      if (
        !operation ||
        !policy.isOnline ||
        !policy.canRecordActivity ||
        snapshot.status === 'PENDING' ||
        snapshot.status === 'RECORDED'
      ) {
        return false;
      }

      snapshot = { operation, status: 'PENDING' };

      try {
        await send(operation);
        if (snapshot.operation?.idempotencyKey === operation.idempotencyKey) {
          snapshot = { operation, status: 'RECORDED' };
        }
        return true;
      } catch (error: unknown) {
        if (snapshot.operation?.idempotencyKey === operation.idempotencyKey) {
          snapshot = { operation, status: 'FAILED' };
        }
        throw error;
      }
    },

    getSnapshot() {
      return snapshot;
    },
  };
}
