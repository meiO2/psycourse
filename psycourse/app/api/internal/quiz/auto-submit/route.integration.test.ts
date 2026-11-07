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
  console.warn("Skipping internal auto-submit HTTP integration tests: TEST_DATABASE_URL is not configured.");
}

suite("internal auto-submit HTTP integration", () => {
  let db: typeof import("@/lib/db").db;
  let post: typeof import("./route").POST;
  let userId: string;
  let test2Id: string;
  let test1Id: string;
  let questionId: string;
  let categoryId: string;
  const testIds: string[] = [];
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const schedulerSecret = "e2e-only-internal-scheduler-secret";
  const requestContext = { params: Promise.resolve({}) };

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.INTERNAL_SCHEDULER_SECRET = schedulerSecret;
    delete process.env.AUTO_SUBMIT_BATCH_SIZE;
    vi.resetModules();
    const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
    delete prismaGlobal.prisma;

    ({ db } = await import("@/lib/db"));
    ({ post } = { post: (await import("./route")).POST });

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

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const category = await db.category.create({
      data: {
        slug: `e2e-auto-submit-${suffix}`,
        judul: "E2E Auto Submit",
        subjudul: "E2E",
        ikon: "test",
        warna: "#000000",
        deskripsi: "E2E fixture",
        status: ContentStatus.AKTIF,
      },
    });
    categoryId = category.id;

    const user = await db.user.create({
      data: {
        email: `e2e-auto-submit-${suffix}@example.test`,
        passwordHash: "e2e-test-only",
        nama: "E2E Auto Submit",
        emailVerified: new Date(),
      },
    });
    userId = user.id;

    const test2 = await db.test.create({
      data: {
        categoryId,
        slug: `e2e-test-2-${suffix}`,
        tipe: TestType.TEST_2,
        timerDetik: 60,
        status: ContentStatus.AKTIF,
      },
    });
    test2Id = test2.id;
    testIds.push(test2.id);

    const test1 = await db.test.create({
      data: {
        categoryId,
        slug: `e2e-test-1-${suffix}`,
        tipe: TestType.TEST_1,
        timerDetik: null,
        status: ContentStatus.AKTIF,
      },
    });
    test1Id = test1.id;
    testIds.push(test1.id);

    const question = await db.question.create({
      data: {
        testId: test2Id,
        urutan: 1,
        teks: "E2E question",
        pilihan: ["A", "B"],
        kunciJawaban: 1,
        penjelasan: "E2E",
        status: ContentStatus.AKTIF,
      },
    });
    questionId = question.id;
  });

  beforeEach(async () => {
    await db.attemptAnswer.deleteMany({ where: { attempt: { userId } } });
    await db.attempt.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    try {
      if (userId) await db.attemptAnswer.deleteMany({ where: { attempt: { userId } } });
      if (userId) await db.attempt.deleteMany({ where: { userId } });
      if (testIds.length) await db.question.deleteMany({ where: { testId: { in: testIds } } });
      if (testIds.length) await db.test.deleteMany({ where: { id: { in: testIds } } });
      if (categoryId) await db.category.delete({ where: { id: categoryId } });
      if (userId) await db.user.delete({ where: { id: userId } });
    } finally {
      await db.$disconnect();
      const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
      delete prismaGlobal.prisma;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      delete process.env.INTERNAL_SCHEDULER_SECRET;
      delete process.env.AUTO_SUBMIT_BATCH_SIZE;
    }
  });

  async function createAttempt(options: {
    testId?: string;
    deadlineAt: Date | null;
    answer?: number;
  }) {
    const attempt = await db.attempt.create({
      data: {
        userId,
        testId: options.testId ?? test2Id,
        status: AttemptStatus.BERLANGSUNG,
        mulaiPada: new Date(Date.now() - 120_000),
        deadlineAt: options.deadlineAt,
        totalSoal: 1,
      },
    });
    if (options.answer !== undefined) {
      await db.attemptAnswer.create({
        data: { attemptId: attempt.id, questionId, pilihan: options.answer },
      });
    }
    return attempt;
  }

  function httpRequest(options: {
    token?: string;
    body?: unknown;
  } = {}) {
    return new Request("http://localhost/api/internal/quiz/auto-submit", {
      method: "POST",
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  async function invoke(options: { token?: string; body?: unknown } = {}) {
    return post(httpRequest(options), requestContext);
  }

  it("finalizes an expired Test 2 attempt through the HTTP route and persists its score", async () => {
    const attempt = await createAttempt({
      deadlineAt: new Date(Date.now() - 10_000),
      answer: 1,
    });

    const response = await invoke({ token: schedulerSecret });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { processed: 1, skipped: 0, failed: 0 } });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 1,
    });
  });

  it("is idempotent when the same HTTP request is sent again", async () => {
    const attempt = await createAttempt({
      deadlineAt: new Date(Date.now() - 10_000),
      answer: 1,
    });

    await invoke({ token: schedulerSecret });
    const finalized = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const response = await invoke({ token: schedulerSecret });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { processed: 0, skipped: 0, failed: 0 } });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: finalized.status,
      skor: finalized.skor,
      selesaiPada: finalized.selesaiPada,
    });
  });

  it("does not process Test 1 or an unexpired Test 2 attempt", async () => {
    const test1Attempt = await createAttempt({
      testId: test1Id,
      deadlineAt: null,
    });
    const futureAttempt = await createAttempt({
      deadlineAt: new Date(Date.now() + 60_000),
    });

    const response = await invoke({ token: schedulerSecret });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { processed: 0, skipped: 0, failed: 0 } });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: test1Attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.BERLANGSUNG,
      skor: null,
    });
    await expect(db.attempt.findUniqueOrThrow({ where: { id: futureAttempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.BERLANGSUNG,
      skor: null,
    });
  });

  it("rejects missing and invalid tokens without changing the database", async () => {
    const attempt = await createAttempt({ deadlineAt: new Date(Date.now() - 10_000) });

    await expect(invoke()).resolves.toHaveProperty("status", 401);
    await expect(invoke({ token: "wrong-secret" })).resolves.toHaveProperty("status", 401);
    expect(await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({
      status: AttemptStatus.BERLANGSUNG,
      skor: null,
    });
  });

  it("ignores payload fields that attempt to change processing or expose answer data", async () => {
    const attempt = await createAttempt({
      deadlineAt: new Date(Date.now() - 10_000),
      answer: 1,
    });

    const response = await invoke({
      token: schedulerSecret,
      body: {
        score: 999,
        deadlineAt: "2099-01-01T00:00:00.000Z",
        status: AttemptStatus.SELESAI,
        kunciJawaban: 0,
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { processed: 1, skipped: 0, failed: 0 } });
    expect(JSON.stringify(body)).not.toContain("kunciJawaban");
    expect(JSON.stringify(body)).not.toContain("jawaban");
    await expect(db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).resolves.toMatchObject({
      status: AttemptStatus.KEDALUWARSA,
      skor: 1,
    });
  });
});
