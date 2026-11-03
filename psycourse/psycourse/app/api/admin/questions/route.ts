import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { ContentStatus, TestType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

const testLabels: Record<TestType, string> = {
  [TestType.TEST_1]: "Test 1",
  [TestType.TEST_2]: "Test 2",
  [TestType.PRACTICE]: "Practice Question Bank",
};

const statusLabels: Record<ContentStatus, string> = {
  [ContentStatus.DRAFT]: "Draft",
  [ContentStatus.AKTIF]: "Aktif",
  [ContentStatus.NONAKTIF]: "Nonaktif",
};

export const GET = withErrors(async (request) => {
  if (!request.headers.has("cookie")) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  await requireAdmin();
  const questions = await db.question.findMany({
    orderBy: [{ createdAt: "desc" }, { urutan: "asc" }],
    take: 500,
    select: {
      id: true,
      teks: true,
      status: true,
      urutan: true,
      test: {
        select: {
          tipe: true,
          category: { select: { judul: true } },
        },
      },
    },
  });

  return Response.json(
    {
      questions: questions.map((question) => ({
        id: question.id,
        urutan: question.urutan,
        teks: question.teks,
        kategori: question.test.category.judul,
        tes: testLabels[question.test.tipe],
        status: statusLabels[question.status],
      })),
      targets: await db.test.findMany({
        where: {
          status: ContentStatus.AKTIF,
          category: { status: ContentStatus.AKTIF },
        },
        orderBy: [{ category: { urutan: "asc" } }, { tipe: "asc" }],
        select: {
          id: true,
          tipe: true,
          category: { select: { judul: true } },
          _count: { select: { questions: true } },
        },
      }).then((targets) =>
        targets.map((target) => ({
          id: target.id,
          label: `${target.category.judul} — ${testLabels[target.tipe]} (${target._count.questions} soal)`,
        })),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

export const POST = withErrors(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!body) return validationError("Data soal tidak valid.");

  const testId = typeof body.testId === "string" ? body.testId.trim() : "";
  const teks = typeof body.question === "string" ? body.question.trim() : "";
  const pilihan = Array.isArray(body.choices)
    ? body.choices.map((choice) => typeof choice === "string" ? choice.trim() : "")
    : [];
  const answer = body.answer;
  const penjelasan = typeof body.explanation === "string" ? body.explanation.trim() : "";
  const rawStatus = typeof body.status === "string" ? body.status.trim().toLocaleLowerCase("id-ID") : "draft";

  if (!testId) return validationError("Pilih kategori dan tes tujuan.");
  if (!teks || teks.length > 5000) return validationError("Pertanyaan wajib diisi (maksimal 5.000 karakter).");
  if (pilihan.length < 2 || pilihan.length > 10 || pilihan.some((choice) => !choice || choice.length > 500)) {
    return validationError("Isi 2–10 pilihan jawaban yang tidak kosong (maksimal 500 karakter per pilihan).");
  }
  if (!Number.isInteger(answer) || typeof answer !== "number" || answer < 1 || answer > pilihan.length) {
    return validationError(`Jawaban benar harus berupa nomor pilihan 1–${pilihan.length}.`);
  }
  if (penjelasan.length > 10000) return validationError("Pembahasan maksimal 10.000 karakter.");

  const statusByInput: Record<string, ContentStatus> = {
    draft: ContentStatus.DRAFT,
    aktif: ContentStatus.AKTIF,
    nonaktif: ContentStatus.NONAKTIF,
  };
  const status = statusByInput[rawStatus];
  if (!status) return validationError("Status harus Draft, Aktif, atau Nonaktif.");

  const target = await db.test.findUnique({
    where: { id: testId },
    select: { id: true, status: true, category: { select: { status: true } } },
  });
  if (!target || target.status !== ContentStatus.AKTIF || target.category.status !== ContentStatus.AKTIF) {
    return apiError("IMPORT_TARGET_UNAVAILABLE", "Kategori atau tes tujuan tidak tersedia.", 404);
  }

  const created = await db.$transaction(async (transaction) => {
    const latestQuestion = await transaction.question.aggregate({
      where: { testId: target.id },
      _max: { urutan: true },
    });
    return transaction.question.create({
      data: {
        testId: target.id,
        urutan: (latestQuestion._max.urutan ?? 0) + 1,
        teks,
        pilihan,
        kunciJawaban: answer - 1,
        penjelasan,
        status,
      },
      select: { id: true },
    });
  });

  return Response.json({ id: created.id }, { status: 201 });
});
