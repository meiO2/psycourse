import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptStatus, ContentStatus, TestType } from "@/lib/generated/prisma/enums";

const configuredDatabaseUrl = process.env.TEST_DATABASE_URL;
let testDatabaseUrl: string | undefined;

if (configuredDatabaseUrl) {
  const parsed = new URL(configuredDatabaseUrl);
  const databaseName = parsed.pathname.replace(/^\/+/, "");
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (!isLocalHost || parsed.port !== "55432" || databaseName !== "psycourse_test") {
    throw new Error(
      "TEST_DATABASE_URL harus menunjuk ke localhost/127.0.0.1:55432 dengan database psycourse_test.",
    );
  }
  testDatabaseUrl = configuredDatabaseUrl;
}

const runIntegration = Boolean(testDatabaseUrl);
const suite = describe.skipIf(!runIntegration);

if (!runIntegration) {
  console.warn("Skipping PostgreSQL integration tests: TEST_DATABASE_URL is not configured.");
}

suite("PostgreSQL auto-submit integration", () => {
  let db: typeof import("@/lib/db").db;
  let autoSubmitExpiredAttempts: typeof import("./auto-submit").autoSubmitExpiredAttempts;
  let submitAttempt: typeof import("./service").submitAttempt;
  let saveAnswer: typeof import("./service").saveAnswer;
  let userId: string;
  let test2Id: string;
  let test1Id: string;
  let question1Id: string;
  let question2Id: string;
  let categoryId: string | undefined;
  const testIds: string[] = [];
  const questionIds: string[] = [];
  const originalDatabaseUrl = process.env.DATABASE_URL;

  const now = new Date();

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    vi.resetModules();
    const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
    delete prismaGlobal.prisma;
    ({ db } = await import("@/lib/db"));
    ({ autoSubmitExpiredAttempts } = await import("./auto-submit"));
    ({ submitAttempt } = await import("./service"));
    ({ saveAnswer } = await import("./service"));

    const identity = await db.$queryRaw<
      Array<{ database_name: string; current_user: string; server_port: number }>
    >`SELECT current_database() AS database_name, current_user, inet_server_port() AS server_port`;
    const [databaseIdentity] = identity;
    if (
      !databaseIdentity ||
      databaseIdentity.database_name !== "psycourse_test" ||
      databaseIdentity.current_user !== "psycourse_test" ||
      databaseIdentity.server_port !== 5432
    ) {
      throw new Error("Database identity tidak sesuai dengan database testing psycourse_test.");
    }

    const category = await db.category.create({
      data: {
        slug: `integration-${Date.now()}`,
        judul: "Integration",
        subjudul: "Integration",
        ikon: "test",
        warna: "#000000",
        deskripsi: "Integration test data",
        status: ContentStatus.AKTIF,
      },
    });
    categoryId = category.id;
    const user = await db.user.create({
      data: {
        email: `integration-${Date.now()}@example.test`,
        passwordHash: "integration-test-only",
        nama: "Integration Test",
        emailVerified: now,
      },
    });
    userId = user.id;
    const test2 = await db.test.create({
      data: {
        categoryId: category.id,
        slug: `integration-test-2-${Date.now()}`,
        tipe: TestType.TEST_2,
        timerDetik: 60,
        status: ContentStatus.AKTIF,
      },
    });
    testIds.push(test2.id);
    test2Id = test2.id;
    const test1 = await db.test.create({
      data: {
        categoryId: category.id,
        slug: `integration-test-1-${Date.now()}`,
        tipe: TestType.TEST_1,
        timerDetik: null,
        status: ContentStatus.AKTIF,
      },
    });
    testIds.push(test1.id);
    test1Id = test1.id;
    const question1 = await db.question.create({
      data: {
        testId: test2.id,
        urutan: 1,
        teks: "Question one",
        pilihan: ["A", "B"],
        kunciJawaban: 1,
        penjelasan: "Integration",
        status: ContentStatus.AKTIF,
      },
    });
    questionIds.push(question1.id);
    question1Id = question1.id;
    const question2 = await db.question.create({
      data: {
        testId: test2.id,
        urutan: 2,
        teks: "Question two",
        pilihan: ["A", "B"],
        kunciJawaban: 0,
        penjelasan: "Integration",
        status: ContentStatus.AKTIF,
      },
    });
    questionIds.push(question2.id);
    question2Id = question2.id;

  });

  beforeEach(async () => {
    await db.attempt.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    try {
      if (userId) await db.attemptAnswer.deleteMany({ where: { attempt: { userId } } });
      if (userId) await db.attempt.deleteMany({ where: { userId } });
      if (questionIds.length) await db.question.deleteMany({ where: { id: { in: questionIds } } });
      if (testIds.length) await db.test.deleteMany({ where: { id: { in: testIds } } });
      if (categoryId) await db.category.delete({ where: { id: categoryId } });
      if (userId) await db.user.delete({ where: { id: userId } });
    } finally {
      await db.$disconnect();
      const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
      delete prismaGlobal.prisma;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  async function createAttempt(options: {
    testId?: string;
    status?: AttemptStatus;
    deadlineAt: Date | null;
    answers?: Array<{ questionId: string; pilihan: number }>;
  }) {
    const attempt = await db.attempt.create({
      data: {
        userId,
        testId: options.testId ?? test2Id,
        status: options.status ?? AttemptStatus.BERLANGSUNG,
        mulaiPada: new Date(now.getTime() - 120_000),
        deadlineAt: options.deadlineAt,
        totalSoal: 2,
      },
    });
    if (options.answers?.length) {
      await db.attemptAnswer.createMany({
        data: options.answers.map((answer) => ({ ...answer, attemptId: attempt.id })),
      });
    }
    return attempt;
  }

  it("does not finalize an attempt before its deadline", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() + 1_000) });

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });

    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.BERLANGSUNG,
      skor: null,
    });
  });

  it.each([
    ["at", new Date(now.getTime() - 1)],
    ["after", new Date(now.getTime() - 1_000)],
  ])("finalizes an attempt %s its deadline", async (_label, deadlineAt) => {
      const attempt = await createAttempt({ deadlineAt });

      await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 1, skipped: 0, failed: 0 });

      await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
        status: AttemptStatus.KEDALUWARSA,
        skor: 0,
      });
  });

  it("does not process Test 1", async () => {
    const attempt = await createAttempt({ testId: test1Id, deadlineAt: null });

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.BERLANGSUNG,
    });
  });

  it.each([AttemptStatus.SELESAI, AttemptStatus.KEDALUWARSA])(
    "does not re-finalize an attempt already marked %s",
    async (status) => {
      const finishedAt = new Date(now.getTime() - 10_000);
      const attempt = await createAttempt({ status, deadlineAt: finishedAt });
      await db.attempt.update({
        where: { id: attempt.id },
        data: { skor: 1, selesaiPada: finishedAt },
      });

      await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });
      await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
        status,
        skor: 1,
        selesaiPada: finishedAt,
      });
    },
  );

  it("scores committed answers from the database", async () => {
    const attempt = await createAttempt({
      deadlineAt: new Date(now.getTime() - 1),
      answers: [
        { questionId: question1Id, pilihan: 1 },
        { questionId: question2Id, pilihan: 1 },
      ],
    });

    await autoSubmitExpiredAttempts();

    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 1,
    });
  });

  it("scores an attempt without answers as zero", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() - 1) });

    await autoSubmitExpiredAttempts();

    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 0,
    });
  });

  it("processes the same expired attempt once when two workers run concurrently", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() - 1) });

    const results = await Promise.all([autoSubmitExpiredAttempts(), autoSubmitExpiredAttempts()]);

    expect(results.map((result) => result.processed).sort()).toEqual([0, 1]);
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 0,
    });
  });

  it("serializes manual submit and auto-submit", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() - 1) });

    const [, autoResult] = await Promise.all([
      submitAttempt(userId, attempt.id),
      autoSubmitExpiredAttempts(),
    ]);

    expect(autoResult.processed).toBeLessThanOrEqual(1);
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 0,
    });
  });

  it("leaves a locked candidate available for retry after the lock is released", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() - 1) });

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "Attempt" WHERE "id" = ${attempt.id} FOR UPDATE`;
      await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 0, skipped: 0, failed: 0 });
    });

    await expect(autoSubmitExpiredAttempts()).resolves.toEqual({ processed: 1, skipped: 0, failed: 0 });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
    });
  });

  it("does not save an answer after auto-submit finalizes the attempt", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() - 1) });

    await autoSubmitExpiredAttempts();

    await expect(saveAnswer(userId, attempt.id, question1Id, 1)).rejects.toMatchObject({
      code: "ATTEMPT_EXPIRED",
    });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 0,
    });
  });

  it("serializes save answer and auto-submit for an expired attempt", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(now.getTime() - 1) });

    const [saveResult, autoResult] = await Promise.allSettled([
      saveAnswer(userId, attempt.id, question1Id, 1),
      autoSubmitExpiredAttempts(),
    ]);

    expect(saveResult.status).toBe("rejected");
    expect(autoResult.status).toBe("fulfilled");
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 0,
    });
  });

  it("keeps a finalized score unchanged on repeated processing", async () => {
    const attempt = await createAttempt({
      deadlineAt: new Date(now.getTime() - 1),
      answers: [{ questionId: question1Id, pilihan: 1 }],
    });

    await autoSubmitExpiredAttempts();
    const first = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    await autoSubmitExpiredAttempts();
    const second = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });

    expect(second.status).toBe(first.status);
    expect(second.skor).toBe(first.skor);
    expect(second.selesaiPada).toEqual(first.selesaiPada);
  });

  it("respects the batch limit", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createAttempt({ deadlineAt: new Date(now.getTime() - index - 1) }),
      ),
    );

    await expect(autoSubmitExpiredAttempts(2)).resolves.toEqual({ processed: 2, skipped: 0, failed: 0 });
    const remaining = await db.attempt.count({ where: { id: { in: attempts.map((item) => item.id) }, status: AttemptStatus.BERLANGSUNG } });
    expect(remaining).toBe(1);
  });
});
