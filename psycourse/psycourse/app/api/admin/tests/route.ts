import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { ContentStatus, TestType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

const testLabels: Record<TestType, string> = {
  [TestType.TEST_1]: "Test 1",
  [TestType.TEST_2]: "Test 2",
  [TestType.PRACTICE]: "Practice Question Bank",
};

const testSlugs: Record<TestType, string> = {
  [TestType.TEST_1]: "test-1",
  [TestType.TEST_2]: "test-2",
  [TestType.PRACTICE]: "practice",
};

const statusLabels: Record<ContentStatus, string> = {
  [ContentStatus.DRAFT]: "Draft",
  [ContentStatus.AKTIF]: "Aktif",
  [ContentStatus.NONAKTIF]: "Nonaktif",
};

function isTestType(value: string): value is TestType {
  return Object.values(TestType).some((testType) => testType === value);
}

function isContentStatus(value: string): value is ContentStatus {
  return Object.values(ContentStatus).some((status) => status === value);
}

export const GET = withErrors(async (request) => {
  if (!request.headers.has("cookie")) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  await requireAdmin();

  const [tests, categories] = await Promise.all([
    db.test.findMany({
      orderBy: [{ category: { urutan: "asc" } }, { tipe: "asc" }],
      select: {
        id: true,
        slug: true,
        tipe: true,
        timerDetik: true,
        status: true,
        category: { select: { id: true, judul: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
    db.category.findMany({
      where: { status: ContentStatus.AKTIF },
      orderBy: { urutan: "asc" },
      select: {
        id: true,
        judul: true,
        tests: { select: { tipe: true } },
      },
    }),
  ]);

  return Response.json(
    {
      tests: tests.map((test) => ({
        id: test.id,
        slug: test.slug,
        type: test.tipe,
        name: testLabels[test.tipe],
        categoryId: test.category.id,
        category: test.category.judul,
        timerSeconds: test.timerDetik,
        status: test.status,
        statusLabel: statusLabels[test.status],
        questionCount: test._count.questions,
        attemptCount: test._count.attempts,
      })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.judul,
        availableTypes: Object.values(TestType).filter(
          (type) => !category.tests.some((test) => test.tipe === type),
        ),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

export const POST = withErrors(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!body) return validationError("Data versi tes tidak valid.");

  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!categoryId) return validationError("Pilih course untuk versi tes.");
  if (!isTestType(type)) return validationError("Jenis tes tidak valid.");

  const testType = type;
  const timerSeconds = parseTimer(body.timerSeconds, testType);
  if ("error" in timerSeconds) return validationError(timerSeconds.error);

  const rawStatus = typeof body.status === "string" ? body.status : ContentStatus.DRAFT;
  if (!isContentStatus(rawStatus)) return validationError("Status harus Draft, Aktif, atau Nonaktif.");

  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, slug: true, judul: true, status: true },
  });
  if (!category || category.status !== ContentStatus.AKTIF) {
    return apiError("CATEGORY_UNAVAILABLE", "Course tidak aktif atau tidak ditemukan.", 404);
  }

  const existing = await db.test.findUnique({
    where: { categoryId_tipe: { categoryId, tipe: testType } },
    select: { id: true },
  });
  if (existing) return apiError("TEST_VERSION_EXISTS", "Versi tes ini sudah ada untuk course tersebut.", 409);

  const created = await db.test.create({
    data: {
      categoryId,
      slug: `${category.slug}-${testSlugs[testType]}`,
      tipe: testType,
      timerDetik: timerSeconds.value,
      status: rawStatus,
    },
    select: { id: true },
  });

  return Response.json({ id: created.id }, { status: 201 });
});

function parseTimer(value: unknown, type: TestType): { value: number | null } | { error: string } {
  if (type !== TestType.TEST_2) {
    if (value !== null && value !== "" && value !== undefined) {
      return { error: "Timer hanya dapat diatur untuk Test 2." };
    }
    return { value: null };
  }
  if (value === null || value === "" || value === undefined) return { value: null };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 60 || value > 86400) {
    return { error: "Durasi Test 2 harus 60–86.400 detik, atau kosongkan untuk tanpa timer." };
  }
  return { value };
}
