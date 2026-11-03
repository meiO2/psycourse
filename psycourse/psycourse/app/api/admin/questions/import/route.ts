import { requireAdmin } from "@/lib/auth";
import { apiError, validationError, withErrors } from "@/lib/api";
import { ContentStatus, TestType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { parseQuestionCsv } from "@/lib/question-csv";

const MAX_FILE_BYTES = 1024 * 1024;

const testLabels: Record<TestType, string> = {
  [TestType.TEST_1]: "Test 1",
  [TestType.TEST_2]: "Test 2",
  [TestType.PRACTICE]: "Practice Question Bank",
};

export const GET = withErrors(async (request) => {
  if (!request.headers.has("cookie")) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  await requireAdmin();
  const categories = await db.category.findMany({
    where: { status: ContentStatus.AKTIF },
    orderBy: { urutan: "asc" },
    select: {
      id: true,
      judul: true,
      tests: {
        where: { status: ContentStatus.AKTIF },
        orderBy: { tipe: "asc" },
        select: {
          id: true,
          tipe: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  return Response.json({
    targets: categories.flatMap((category) =>
      category.tests.map((test) => ({
        id: test.id,
        label: `${category.judul} — ${testLabels[test.tipe]} (${test._count.questions} soal)`,
      })),
    ),
  });
});

export const POST = withErrors(async (request) => {
  await requireAdmin();

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 64 * 1024) {
    return validationError("Ukuran file CSV maksimal 1 MB.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return validationError("Kirim file CSV menggunakan multipart/form-data.");
  }

  const testId = form.get("testId");
  const file = form.get("file");
  if (typeof testId !== "string" || !testId.trim()) {
    return validationError("Pilih kategori dan tes tujuan impor.");
  }
  if (!(file instanceof File) || !file.name.toLocaleLowerCase("id-ID").endsWith(".csv")) {
    return validationError("Pilih file dengan ekstensi .csv.");
  }
  if (file.size === 0) return validationError("File CSV kosong.");
  if (file.size > MAX_FILE_BYTES) return validationError("Ukuran file CSV maksimal 1 MB.");

  const parsed = parseQuestionCsv(await file.text());
  if ("error" in parsed) return validationError(parsed.error);

  const target = await db.test.findUnique({
    where: { id: testId.trim() },
    select: {
      id: true,
      status: true,
      category: { select: { status: true } },
    },
  });
  if (!target || target.status !== ContentStatus.AKTIF || target.category.status !== ContentStatus.AKTIF) {
    return apiError("IMPORT_TARGET_UNAVAILABLE", "Kategori atau tes tujuan tidak tersedia.", 404);
  }

  const incomingTexts = parsed.rows.map((row) => row.teks.toLocaleLowerCase("id-ID"));
  const existingQuestions = await db.question.findMany({
    where: { testId: target.id },
    select: { teks: true },
  });
  const existingTexts = new Set(existingQuestions.map((question) => question.teks.toLocaleLowerCase("id-ID")));
  const duplicateIndex = incomingTexts.findIndex((text) => existingTexts.has(text));
  if (duplicateIndex !== -1) {
    return apiError(
      "DUPLICATE_QUESTION",
      `Pertanyaan baris data ${duplicateIndex + 1} sudah ada pada tes tujuan. Tidak ada soal yang diimpor.`,
      409,
    );
  }

  const imported = await db.$transaction(async (transaction) => {
    const latestQuestion = await transaction.question.aggregate({
      where: { testId: target.id },
      _max: { urutan: true },
    });
    const firstOrder = (latestQuestion._max.urutan ?? 0) + 1;

    return transaction.question.createMany({
      data: parsed.rows.map((question, index) => ({
        testId: target.id,
        urutan: firstOrder + index,
        teks: question.teks,
        pilihan: question.pilihan,
        kunciJawaban: question.kunciJawaban,
        penjelasan: question.penjelasan,
        status: question.status,
      })),
    });
  });

  return Response.json({ imported: imported.count }, { status: 201 });
});
