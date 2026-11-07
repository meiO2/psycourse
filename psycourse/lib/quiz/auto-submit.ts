import { db } from "@/lib/db";
import { AttemptStatus } from "@/lib/generated/prisma/enums";
import { finalizeLockedAttempt } from "./service";
import { isPastDeadline } from "./policy";

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;

export type AutoSubmitBatchResult = {
  processed: number;
  skipped: number;
  failed: number;
};

function validateBatchSize(batchSize: number): number {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new RangeError(`batchSize harus berupa integer antara 1 dan ${MAX_BATCH_SIZE}.`);
  }
  return batchSize;
}

/**
 * Finalizes expired Test 2 attempts. A scheduler must invoke this function;
 * importing this service does not start a background process.
 */
export async function autoSubmitExpiredAttempts(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<AutoSubmitBatchResult> {
  const limit = validateBatchSize(batchSize);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT a."id"
      FROM "Attempt" a
      INNER JOIN "Test" t ON t."id" = a."testId"
      WHERE a."status" = 'BERLANGSUNG'
        AND a."deadlineAt" IS NOT NULL
        AND a."deadlineAt" <= ${now}
        AND t."tipe" = 'TEST_2'
      ORDER BY a."deadlineAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF a SKIP LOCKED
    `;

    const result: AutoSubmitBatchResult = { processed: 0, skipped: 0, failed: 0 };
    for (const candidate of candidates) {
      const attempt = await tx.attempt.findUniqueOrThrow({
        where: { id: candidate.id },
        select: { status: true, deadlineAt: true },
      });

      if (attempt.status !== AttemptStatus.BERLANGSUNG || !isPastDeadline(attempt.deadlineAt, now)) {
        result.skipped += 1;
        continue;
      }

      await finalizeLockedAttempt(tx, candidate.id, AttemptStatus.KEDALUWARSA);
      result.processed += 1;
    }

    return result;
  });
}
