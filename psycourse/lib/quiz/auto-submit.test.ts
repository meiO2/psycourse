import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptStatus } from "@/lib/generated/prisma/enums";

const { dbMock, state } = vi.hoisted(() => {
  const state = {
    attempts: [] as Array<{
      id: string;
      tipe: "TEST_1" | "TEST_2";
      status: AttemptStatus;
      deadlineAt: Date | null;
      mulaiPada: Date;
      totalSoal: number;
      skor: number | null;
      selesaiPada: Date | null;
      answers: Array<{ pilihan: number; question: { kunciJawaban: number } }>;
    }>,
    failOnUpdate: false,
  };

  const tx = {
    $queryRaw: vi.fn(async () =>
      state.attempts
        .filter(
          (attempt) =>
            attempt.status === AttemptStatus.BERLANGSUNG &&
            attempt.tipe === "TEST_2" &&
            attempt.deadlineAt !== null &&
            attempt.deadlineAt.getTime() <= Date.now(),
        )
        .slice(0, 100)
        .map((attempt) => ({ id: attempt.id })),
    ),
    attempt: {
      findUniqueOrThrow: vi.fn(async ({ where, select }: { where: { id: string }; select?: unknown }) => {
        const attempt = state.attempts.find((candidate) => candidate.id === where.id);
        if (!attempt) throw new Error("attempt missing");
        if (select) return { status: attempt.status, deadlineAt: attempt.deadlineAt };
        return {
          ...attempt,
          answers: attempt.answers,
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status: AttemptStatus; skor: number; selesaiPada: Date } }) => {
        if (state.failOnUpdate) throw new Error("database unavailable");
        const attempt = state.attempts.find((candidate) => candidate.id === where.id);
        if (!attempt) throw new Error("attempt missing");
        Object.assign(attempt, data);
        return attempt;
      }),
    },
  };

  const dbMock = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const snapshot = structuredClone(state.attempts);
      try {
        return await callback(tx);
      } catch (error) {
        state.attempts = snapshot;
        throw error;
      }
    }),
  };

  return { dbMock, state };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { autoSubmitExpiredAttempts } from "./auto-submit";

const now = new Date("2026-11-07T11:00:00.000Z");

function attempt(
  id: string,
  tipe: "TEST_1" | "TEST_2",
  status: AttemptStatus,
  deadlineAt: Date | null,
  answers: Array<{ pilihan: number; question: { kunciJawaban: number } }> = [],
) {
  return {
    id,
    tipe,
    status,
    deadlineAt,
    mulaiPada: new Date(now.getTime() - 60_000),
    totalSoal: 2,
    skor: null,
    selesaiPada: null,
    answers,
  };
}

describe("auto-submit expired attempts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    state.attempts = [];
    state.failOnUpdate = false;
    vi.clearAllMocks();
  });

  it("does not process a Test 2 attempt before its deadline", async () => {
    state.attempts = [attempt("before", "TEST_2", AttemptStatus.BERLANGSUNG, new Date(now.getTime() + 1))];

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect(state.attempts[0].status).toBe(AttemptStatus.BERLANGSUNG);
  });

  it.each([
    ["at", now, now],
    ["after", now, new Date(now.getTime() + 1)],
  ])("processes a Test 2 attempt %s its deadline", async (_label, deadlineAt, currentTime) => {
    state.attempts = [attempt("expired", "TEST_2", AttemptStatus.BERLANGSUNG, deadlineAt)];
    vi.setSystemTime(currentTime);

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 1, skipped: 0, failed: 0 });
    expect(state.attempts[0].status).toBe(AttemptStatus.KEDALUWARSA);
    expect(state.attempts[0].skor).toBe(0);
    expect(state.attempts[0].selesaiPada).toEqual(currentTime);
  });

  it.each([AttemptStatus.SELESAI, AttemptStatus.KEDALUWARSA])("skips an already final %s attempt", async (status) => {
    state.attempts = [attempt("final", "TEST_2", status, new Date(now.getTime() - 1))];

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect(state.attempts[0].status).toBe(status);
  });

  it("does not process Test 1 or attempts without a deadline", async () => {
    state.attempts = [
      attempt("test-1", "TEST_1", AttemptStatus.BERLANGSUNG, null),
      attempt("no-deadline", "TEST_2", AttemptStatus.BERLANGSUNG, null),
    ];

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect(state.attempts.every((candidate) => candidate.status === AttemptStatus.BERLANGSUNG)).toBe(true);
  });

  it("scores only stored answers", async () => {
    state.attempts = [
      attempt("scored", "TEST_2", AttemptStatus.BERLANGSUNG, new Date(now.getTime() - 1), [
        { pilihan: 1, question: { kunciJawaban: 1 } },
        { pilihan: 0, question: { kunciJawaban: 1 } },
      ]),
    ];

    await autoSubmitExpiredAttempts();

    expect(state.attempts[0].skor).toBe(1);
  });

  it("is idempotent when invoked repeatedly", async () => {
    state.attempts = [attempt("repeat", "TEST_2", AttemptStatus.BERLANGSUNG, new Date(now.getTime() - 1))];

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 1, skipped: 0, failed: 0 });
    const firstResult = { status: state.attempts[0].status, skor: state.attempts[0].skor, selesaiPada: state.attempts[0].selesaiPada };
    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });

    expect(state.attempts[0]).toMatchObject(firstResult);
  });

  it("rolls back the batch when finalization fails", async () => {
    state.attempts = [
      attempt("failed", "TEST_2", AttemptStatus.BERLANGSUNG, new Date(now.getTime() - 1)),
      attempt("also-failed", "TEST_2", AttemptStatus.BERLANGSUNG, new Date(now.getTime() - 1)),
    ];
    state.failOnUpdate = true;

    await expect(autoSubmitExpiredAttempts()).rejects.toThrow("database unavailable");
    expect(state.attempts.every((candidate) => candidate.status === AttemptStatus.BERLANGSUNG)).toBe(true);
  });

  it("rejects unsafe batch sizes", async () => {
    await expect(autoSubmitExpiredAttempts(0)).rejects.toThrow(RangeError);
    await expect(autoSubmitExpiredAttempts(101)).rejects.toThrow(RangeError);
    await expect(autoSubmitExpiredAttempts(1.5)).rejects.toThrow(RangeError);
  });
});
