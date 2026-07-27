import { Prisma, type PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import { PrismaProgressTrackingRepository } from '../../src/modules/progress-tracking/progress-tracking.repository.js';

function knownError(
  code: string,
  target?: string | string[],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Database conflict', {
    code,
    clientVersion: Prisma.prismaVersion.client,
    ...(target ? { meta: { target } } : {}),
  });
}

describe('PrismaProgressTrackingRepository transaction policy', () => {
  it('uses SERIALIZABLE isolation for progress transactions', async () => {
    const transaction = {};
    const client = {
      $transaction: vi.fn(
        async (operation: (value: object) => Promise<string>, options: object) => {
          expect(options).toEqual({
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
          return operation(transaction);
        },
      ),
    } as unknown as PrismaClient;
    const repository = new PrismaProgressTrackingRepository(client);

    await expect(repository.withSerializableTransaction(async () => 'ok')).resolves.toBe('ok');
  });

  it('retries only genuine serialization conflicts within the bounded policy', async () => {
    let attempts = 0;
    const client = {
      $transaction: vi.fn(async (operation: (value: object) => Promise<string>) => {
        attempts += 1;
        if (attempts < 3) throw knownError('P2034');
        return operation({});
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaProgressTrackingRepository(client);

    await expect(repository.withSerializableTransaction(async () => 'committed')).resolves.toBe(
      'committed',
    );
    expect(attempts).toBe(3);
  });

  it('does not retry an unrelated uniqueness failure', async () => {
    let attempts = 0;
    const failure = knownError('P2002', 'unrelated_unique_constraint');
    const client = {
      $transaction: vi.fn(async () => {
        attempts += 1;
        throw failure;
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaProgressTrackingRepository(client);

    await expect(repository.withSerializableTransaction(async () => 'never')).rejects.toBe(failure);
    expect(attempts).toBe(1);
  });

  it('retries the actor-scoped idempotency uniqueness race', async () => {
    let attempts = 0;
    const client = {
      $transaction: vi.fn(async (operation: (value: object) => Promise<string>) => {
        attempts += 1;
        if (attempts === 1) {
          throw knownError('P2002', 'idempotency_records_actor_user_id_key_key');
        }
        return operation({});
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaProgressTrackingRepository(client);

    await expect(repository.withSerializableTransaction(async () => 'replayed')).resolves.toBe(
      'replayed',
    );
    expect(attempts).toBe(2);
  });

  it('recognizes Prisma field-list metadata only for the exact progress identities', async () => {
    let attempts = 0;
    const client = {
      $transaction: vi.fn(async (operation: (value: object) => Promise<string>) => {
        attempts += 1;
        if (attempts === 1) {
          throw knownError('P2002', ['actor_user_id', 'key']);
        }
        return operation({});
      }),
    } as unknown as PrismaClient;
    const repository = new PrismaProgressTrackingRepository(client);

    await expect(repository.withSerializableTransaction(async () => 'replayed')).resolves.toBe(
      'replayed',
    );
    expect(attempts).toBe(2);

    const unrelated = knownError('P2002', ['actor_user_id', 'other_key']);
    const unrelatedClient = {
      $transaction: vi.fn(async () => {
        throw unrelated;
      }),
    } as unknown as PrismaClient;
    await expect(
      new PrismaProgressTrackingRepository(unrelatedClient).withSerializableTransaction(
        async () => 'never',
      ),
    ).rejects.toBe(unrelated);
  });
});
