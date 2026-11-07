import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ContentStatus, TestType } from "../lib/generated/prisma/enums";
import { sampleQuestions } from "../lib/data";
import { ensurePracticeFixture } from "./practice-fixture";

const configuredDatabaseUrl = process.env.TEST_DATABASE_URL;
let testDatabaseUrl: string | undefined;

if (configuredDatabaseUrl) {
  const parsed = new URL(configuredDatabaseUrl);
  const databaseName = parsed.pathname.replace(/^\/+/, "");
  const username = decodeURIComponent(parsed.username);
  if (
    (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55432" ||
    databaseName !== "psycourse_test" ||
    username !== "psycourse_test"
  ) {
    throw new Error(
      "TEST_DATABASE_URL harus menunjuk ke postgresql://psycourse_test@127.0.0.1:55432/psycourse_test.",
    );
  }
  testDatabaseUrl = configuredDatabaseUrl;
}

const runIntegration = Boolean(testDatabaseUrl);
const suite = describe.skipIf(!runIntegration);

if (!runIntegration) {
  console.warn("Skipping Practice fixture integration tests: TEST_DATABASE_URL is not configured.");
}

suite("Practice fixture integration", () => {
  let db: typeof import("../lib/db").db;
  const categoryIds: string[] = [];
  const testIds: string[] = [];
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    vi.resetModules();
    const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
    delete prismaGlobal.prisma;
    ({ db } = await import("../lib/db"));

    const identity = await db.$queryRaw<
      Array<{ database_name: string; current_user: string; server_port: number }>
    >`SELECT current_database() AS database_name, current_user, inet_server_port() AS server_port`;
    const [databaseIdentity] = identity;
    if (
      databaseIdentity?.database_name !== "psycourse_test" ||
      databaseIdentity.current_user !== "psycourse_test" ||
      databaseIdentity.server_port !== 5432
    ) {
      throw new Error("Database identity tidak sesuai dengan database testing Practice.");
    }

    const suffix = `practice-fixture-${Date.now()}-${crypto.randomUUID()}`;
    const emptyCategory = await db.category.create({
      data: {
        slug: `${suffix}-empty-category`,
        judul: "Practice Fixture Empty",
        subjudul: "Integration",
        ikon: "test",
        warna: "#000000",
        deskripsi: "Temporary Practice fixture",
        status: ContentStatus.AKTIF,
      },
    });
    categoryIds.push(emptyCategory.id);

    const emptyPractice = await db.test.create({
      data: {
        categoryId: emptyCategory.id,
        slug: `${suffix}-empty`,
        tipe: TestType.PRACTICE,
        timerDetik: null,
        status: ContentStatus.AKTIF,
      },
    });
    testIds.push(emptyPractice.id);

    const draftCategory = await db.category.create({
      data: {
        slug: `${suffix}-draft-category`,
        judul: "Practice Fixture Draft",
        subjudul: "Integration",
        ikon: "test",
        warna: "#000000",
        deskripsi: "Temporary Practice fixture",
        status: ContentStatus.AKTIF,
      },
    });
    categoryIds.push(draftCategory.id);

    const draftPractice = await db.test.create({
      data: {
        categoryId: draftCategory.id,
        slug: `${suffix}-draft`,
        tipe: TestType.PRACTICE,
        timerDetik: null,
        status: ContentStatus.AKTIF,
      },
    });
    testIds.push(draftPractice.id);
    await db.question.create({
      data: {
        testId: draftPractice.id,
        urutan: 1,
        teks: "Existing draft question",
        pilihan: ["existing", "draft"],
        kunciJawaban: 0,
        penjelasan: "Must remain unchanged",
        status: ContentStatus.DRAFT,
      },
    });
  });

  afterAll(async () => {
    try {
      if (testIds.length) await db.question.deleteMany({ where: { testId: { in: testIds } } });
      if (testIds.length) await db.test.deleteMany({ where: { id: { in: testIds } } });
      if (categoryIds.length) await db.category.deleteMany({ where: { id: { in: categoryIds } } });
    } finally {
      await db.$disconnect();
      const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
      delete prismaGlobal.prisma;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("creates five active fixture questions for an empty Practice", async () => {
    const created = await ensurePracticeFixture(db, testIds[0]);
    const questions = await db.question.findMany({
      where: { testId: testIds[0] },
      orderBy: { urutan: "asc" },
    });

    expect(created).toBe(true);
    expect(questions).toHaveLength(5);
    expect(questions.every((question) => question.status === ContentStatus.AKTIF)).toBe(true);
    expect(questions.map((question) => question.kunciJawaban)).toEqual(
      sampleQuestions.map((question) => question.answer),
    );
    expect(questions.every((question) => question.dibuatDengan === "Fixture Practice lokal (lib/data.ts)")).toBe(true);
  });

  it("does not duplicate questions when invoked again", async () => {
    await ensurePracticeFixture(db, testIds[0]);
    const created = await ensurePracticeFixture(db, testIds[0]);
    const count = await db.question.count({ where: { testId: testIds[0] } });

    expect(created).toBe(false);
    expect(count).toBe(5);
  });

  it("does not modify or add fixture questions when a draft already exists", async () => {
    const before = await db.question.findMany({
      where: { testId: testIds[1] },
      orderBy: { urutan: "asc" },
    });
    const created = await ensurePracticeFixture(db, testIds[1]);
    const after = await db.question.findMany({
      where: { testId: testIds[1] },
      orderBy: { urutan: "asc" },
    });

    expect(created).toBe(false);
    expect(after).toEqual(before);
  });
});
