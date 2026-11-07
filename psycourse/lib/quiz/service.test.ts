import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptStatus } from "@/lib/generated/prisma/enums";

const { dbMock, accessMock, state } = vi.hoisted(() => {
  const state = {
    test: {
      id: "test-1",
      categoryId: "category-1",
      slug: "test-1",
      tipe: "TEST_1",
      timerDetik: null as number | null,
      status: "AKTIF",
      category: { slug: "category", judul: "Category" },
      questions: [
        {
          id: "question-1",
          urutan: 1,
          teks: "Pilih jawaban.",
          pilihan: ["A", "B"],
          kunciJawaban: 1,
          status: "AKTIF",
        },
        {
          id: "question-2",
          urutan: 2,
          teks: "Pilih jawaban kedua.",
          pilihan: ["A", "B"],
          kunciJawaban: 0,
          status: "AKTIF",
        },
      ],
    },
    attempt: null as null | {
      id: string;
      userId: string;
      testId: string;
      status: string;
      mulaiPada: Date;
      deadlineAt: Date | null;
      selesaiPada: Date | null;
      totalSoal: number;
      skor: number | null;
      answers: Array<{ questionId: string; pilihan: number }>;
    },
  };

  const attemptWithTest = () => {
    if (!state.attempt) return null;
    return {
      ...state.attempt,
      test: {
        id: state.test.id,
        slug: state.test.slug,
        tipe: state.test.tipe,
        timerDetik: state.test.timerDetik,
        category: state.test.category,
      },
      answers: state.attempt.answers.map((answer) => ({ ...answer })),
    };
  };

  const tx = {
    $queryRaw: vi.fn(async (_query: TemplateStringsArray, ...values: unknown[]) => {
      if (!state.attempt) return [];
      const requestedUserId = values[1];
      return requestedUserId !== undefined && requestedUserId !== state.attempt.userId ? [] : [{ id: state.attempt.id }];
    }),
    attempt: {
      findUniqueOrThrow: vi.fn(async () => {
        if (!state.attempt) throw new Error("attempt missing");
        return {
          ...state.attempt,
          answers: state.attempt.answers.map((answer) => ({
            ...answer,
            question: {
              kunciJawaban: state.test.questions.find((question) => question.id === answer.questionId)?.kunciJawaban,
            },
          })),
        };
      }),
      update: vi.fn(async ({ data }: { data: { status: string; skor: number; selesaiPada: Date } }) => {
        if (!state.attempt) throw new Error("attempt missing");
        state.attempt = { ...state.attempt, ...data };
        return state.attempt;
      }),
    },
    question: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const question = state.test.questions.find((candidate) => candidate.id === where.id);
        return question ? { id: question.id, pilihan: question.pilihan } : null;
      }),
    },
    attemptAnswer: {
      upsert: vi.fn(async ({ create, update }: { create: { questionId: string; pilihan: number }; update: { pilihan: number } }) => {
        if (!state.attempt) throw new Error("attempt missing");
        const existing = state.attempt.answers.find((answer) => answer.questionId === create.questionId);
        if (existing) existing.pilihan = update.pilihan;
        else state.attempt.answers.push({ questionId: create.questionId, pilihan: create.pilihan });
        return { ...create };
      }),
    },
  };

  const dbMock = {
    test: {
      findFirst: vi.fn(async () => state.test),
    },
    attempt: {
      create: vi.fn(async ({ data }: { data: Omit<NonNullable<typeof state.attempt>, "id" | "skor" | "selesaiPada" | "answers"> }) => {
        state.attempt = {
          ...data,
          id: "attempt-1",
          skor: null,
          selesaiPada: null,
          answers: [],
        };
        return state.attempt;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        if (!state.attempt || state.attempt.id !== where.id || state.attempt.userId !== where.userId) return null;
        return attemptWithTest();
      }),
    },
    question: {
      findMany: vi.fn(async () => state.test.questions),
    },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  return { dbMock, accessMock: { assertQuizAccess: vi.fn(async () => undefined) }, state };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("./access", () => accessMock);

import { getAttempt, saveAnswer, startAttempt, submitAttempt } from "./service";
import { toPublicQuestion } from "./question-mapper";
import { calculateScore } from "./scoring";

const userId = "user-1";
const otherUserId = "user-2";
const startedAt = new Date("2026-11-04T09:00:00.000Z");

function configureTest(tipe: "TEST_1" | "TEST_2", timerDetik: number | null) {
  state.test.tipe = tipe;
  state.test.timerDetik = timerDetik;
}

describe("quiz service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(startedAt);
    configureTest("TEST_1", null);
    state.attempt = null;
    vi.clearAllMocks();
  });

  it("creates a Test 1 attempt without a deadline", async () => {
    const result = await startAttempt(userId, state.test.slug);

    expect(result.attempt.deadlineAt).toBeNull();
    expect(state.attempt?.deadlineAt).toBeNull();
    expect(result.attempt.mulaiPada).toEqual(startedAt);
  });

  it("creates a Test 2 attempt with a server-calculated deadline", async () => {
    configureTest("TEST_2", 60);

    const result = await startAttempt(userId, state.test.slug);

    expect(result.attempt.deadlineAt).toEqual(new Date("2026-11-04T09:01:00.000Z"));
    expect(state.attempt?.deadlineAt).toEqual(result.attempt.deadlineAt);
  });

  it("saves an answer before the Test 2 deadline", async () => {
    configureTest("TEST_2", 60);
    await startAttempt(userId, state.test.slug);

    await expect(saveAnswer(userId, "attempt-1", "question-1", 1)).resolves.toEqual({
      saved: true,
      questionId: "question-1",
      pilihan: 1,
    });
    expect(state.attempt?.answers).toEqual([{ questionId: "question-1", pilihan: 1 }]);
  });

  it.each([
    ["at", new Date("2026-11-04T09:01:00.000Z")],
    ["after", new Date("2026-11-04T09:01:00.001Z")],
  ])("rejects an answer %s the Test 2 deadline", async (_label, now) => {
    configureTest("TEST_2", 60);
    await startAttempt(userId, state.test.slug);
    vi.setSystemTime(now);

    await expect(saveAnswer(userId, "attempt-1", "question-1", 1)).rejects.toMatchObject({
      code: "ATTEMPT_EXPIRED",
    });
    expect(state.attempt?.status).toBe(AttemptStatus.KEDALUWARSA);
    expect(state.attempt?.answers).toEqual([]);
  });

  it("retrieves a Test 2 attempt without changing its stored deadline", async () => {
    configureTest("TEST_2", 60);
    const started = await startAttempt(userId, state.test.slug);
    vi.setSystemTime(new Date("2026-11-04T09:00:30.000Z"));

    const resumed = await getAttempt(userId, "attempt-1");

    expect(resumed.attempt.deadlineAt).toEqual(started.attempt.deadlineAt);
    expect(state.attempt?.deadlineAt).toEqual(started.attempt.deadlineAt);
  });

  it("submits before the deadline and scores only stored answers", async () => {
    configureTest("TEST_2", 60);
    await startAttempt(userId, state.test.slug);
    await saveAnswer(userId, "attempt-1", "question-1", 1);
    await saveAnswer(userId, "attempt-1", "question-2", 1);

    const result = await submitAttempt(userId, "attempt-1");

    expect(result.status).toBe(AttemptStatus.SELESAI);
    expect(result.skor).toBe(1);
    expect(result.totalSoal).toBe(2);
    expect(result).not.toHaveProperty("score");
  });

  it.each([
    new Date("2026-11-04T09:01:00.000Z"),
    new Date("2026-11-04T09:01:00.001Z"),
  ])("submits as expired at or after the deadline", async (now) => {
    configureTest("TEST_2", 60);
    await startAttempt(userId, state.test.slug);
    await saveAnswer(userId, "attempt-1", "question-1", 1);
    vi.setSystemTime(now);

    const result = await submitAttempt(userId, "attempt-1");

    expect(result.status).toBe(AttemptStatus.KEDALUWARSA);
    expect(result.skor).toBe(1);
  });

  it("keeps repeated submit results idempotent", async () => {
    await startAttempt(userId, state.test.slug);
    await saveAnswer(userId, "attempt-1", "question-1", 1);

    const first = await submitAttempt(userId, "attempt-1");
    const second = await submitAttempt(userId, "attempt-1");

    expect(second).toEqual(first);
  });

  it("rejects answer changes after finalization", async () => {
    await startAttempt(userId, state.test.slug);
    await saveAnswer(userId, "attempt-1", "question-1", 1);
    await submitAttempt(userId, "attempt-1");

    await expect(saveAnswer(userId, "attempt-1", "question-1", 0)).rejects.toMatchObject({
      code: "ATTEMPT_FINISHED",
    });
    expect(state.attempt?.answers).toEqual([{ questionId: "question-1", pilihan: 1 }]);
  });

  it("rejects access to an attempt owned by another user", async () => {
    await startAttempt(userId, state.test.slug);

    await expect(getAttempt(otherUserId, "attempt-1")).rejects.toMatchObject({ code: "ATTEMPT_NOT_FOUND" });
    await expect(saveAnswer(otherUserId, "attempt-1", "question-1", 1)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
    });
    await expect(submitAttempt(otherUserId, "attempt-1")).rejects.toMatchObject({
      code: "ATTEMPT_NOT_FOUND",
    });
  });

  it("calculates scores from database answers and never exposes answer keys", () => {
    expect(
      calculateScore([
        { pilihan: 1, question: { kunciJawaban: 1 } },
        { pilihan: 0, question: { kunciJawaban: 2 } },
      ]),
    ).toBe(1);

    const publicQuestion = toPublicQuestion({
      id: "question-1",
      urutan: 1,
      teks: "Pilih jawaban.",
      pilihan: ["A", "B"],
      kunciJawaban: 1,
      status: "AKTIF",
    });
    expect(publicQuestion).not.toHaveProperty("kunciJawaban");
    expect(publicQuestion).not.toHaveProperty("penjelasan");
  });
});
