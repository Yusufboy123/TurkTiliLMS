import { Prisma } from '@prisma/client';
import { PrismaCertificateIssuanceRepository } from '../../src/modules/certificate-issuance/certificate-issuance.repository.js';

function prismaConflict(code: string, target?: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('conflict', {
    code,
    clientVersion: 'test',
    ...(target ? { meta: { target } } : {}),
  });
}

describe('PrismaCertificateIssuanceRepository retry policy', () => {
  it('uses bounded exponential full jitter and exposes the real attempt', async () => {
    let transactionCalls = 0;
    const client = {
      $transaction: vi.fn(async (operation: (transaction: object) => Promise<number>) => {
        transactionCalls += 1;
        if (transactionCalls < 3) throw prismaConflict('P2034');
        return operation({});
      }),
    };
    const sleeps: number[] = [];
    const repository = new PrismaCertificateIssuanceRepository(client as never, {
      random: () => 0.5,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    });

    await expect(
      repository.withSerializableTransaction(async (_transaction, attempt) => attempt),
    ).resolves.toBe(3);
    expect(sleeps).toEqual([5, 10]);
  });

  it('returns a stable serialization conflict after bounded retry exhaustion', async () => {
    const client = {
      $transaction: vi.fn(async () => {
        throw prismaConflict('P2034');
      }),
    };
    const sleep = vi.fn(async () => undefined);
    const repository = new PrismaCertificateIssuanceRepository(client as never, {
      random: () => 0,
      sleep,
    });

    await expect(
      repository.withSerializableTransaction(async () => undefined),
    ).rejects.toMatchObject({ kind: 'serialization', attempt: 3 });
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('retries expected issuance uniqueness races but never retries numbering conflicts', async () => {
    const enrollmentClient = {
      $transaction: vi.fn(async () => {
        throw prismaConflict('P2002', 'certificates_enrollment_id_key');
      }),
    };
    const repository = new PrismaCertificateIssuanceRepository(enrollmentClient as never, {
      random: () => 0,
      sleep: async () => undefined,
    });
    await expect(
      repository.withSerializableTransaction(async () => undefined),
    ).rejects.toMatchObject({ kind: 'already-issued', attempt: 3 });
    expect(enrollmentClient.$transaction).toHaveBeenCalledTimes(3);

    const numberingClient = {
      $transaction: vi.fn(async () => {
        throw prismaConflict('P2002', 'certificates_certificate_number_key');
      }),
    };
    const numberingRepository = new PrismaCertificateIssuanceRepository(numberingClient as never);
    await expect(
      numberingRepository.withSerializableTransaction(async () => undefined),
    ).rejects.toMatchObject({ kind: 'numbering', attempt: 1 });
    expect(numberingClient.$transaction).toHaveBeenCalledOnce();
  });
});
