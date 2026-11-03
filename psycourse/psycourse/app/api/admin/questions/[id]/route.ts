import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { ContentStatus } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function isContentStatus(value: string): value is ContentStatus {
  return Object.values(ContentStatus).some((status) => status === value);
}

export const GET = withErrors(async (request, { params }: RouteContext) => {
  if (!request.headers.has("cookie")) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  await requireAdmin();
  const { id } = await params;
  const question = await db.question.findUnique({
    where: { id },
    select: {
      id: true,
      teks: true,
      pilihan: true,
      kunciJawaban: true,
      penjelasan: true,
      status: true,
      _count: { select: { answers: true } },
    },
  });
  if (!question) return apiError("QUESTION_NOT_FOUND", "Soal tidak ditemukan.", 404);

  return Response.json({
    id: question.id,
    question: question.teks,
    choices: Array.isArray(question.pilihan)
      ? question.pilihan.filter((choice): choice is string => typeof choice === "string")
      : [],
    answer: question.kunciJawaban + 1,
    explanation: question.penjelasan,
    status: question.status,
    hasAnswers: question._count.answers > 0,
  });
});

export const PATCH = withErrors(async (request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return validationError("Data soal tidak valid.");

  const current = await db.question.findUnique({
    where: { id },
    select: { id: true, _count: { select: { answers: true } } },
  });
  if (!current) return apiError("QUESTION_NOT_FOUND", "Soal tidak ditemukan.", 404);
  if (current._count.answers > 0) {
    return apiError(
      "QUESTION_HAS_ANSWERS",
      "Soal tidak dapat diedit karena sudah digunakan dalam riwayat pengerjaan.",
      409,
    );
  }

  const teks = typeof body.question === "string" ? body.question.trim() : "";
  const pilihan = Array.isArray(body.choices)
    ? body.choices.map((choice) => typeof choice === "string" ? choice.trim() : "")
    : [];
  const answer = body.answer;
  const penjelasan = typeof body.explanation === "string" ? body.explanation.trim() : "";
  const statusValue = typeof body.status === "string" ? body.status : "";

  if (!teks || teks.length > 5000) return validationError("Pertanyaan wajib diisi (maksimal 5.000 karakter).");
  if (pilihan.length < 2 || pilihan.length > 10 || pilihan.some((choice) => !choice || choice.length > 500)) {
    return validationError("Isi 2–10 pilihan jawaban yang tidak kosong (maksimal 500 karakter per pilihan).");
  }
  if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 1 || answer > pilihan.length) {
    return validationError(`Jawaban benar harus berupa nomor pilihan 1–${pilihan.length}.`);
  }
  if (penjelasan.length > 10000) return validationError("Pembahasan maksimal 10.000 karakter.");
  if (!isContentStatus(statusValue)) return validationError("Status harus Draft, Aktif, atau Nonaktif.");

  const updated = await db.question.update({
    where: { id },
    data: {
      teks,
      pilihan,
      kunciJawaban: answer - 1,
      penjelasan,
      status: statusValue,
    },
    select: { id: true },
  });

  return Response.json({ id: updated.id });
});

export const DELETE = withErrors(async (_request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const question = await db.question.findUnique({
    where: { id },
    select: { id: true, _count: { select: { answers: true } } },
  });
  if (!question) return apiError("QUESTION_NOT_FOUND", "Soal tidak ditemukan.", 404);
  if (question._count.answers > 0) {
    return apiError(
      "QUESTION_HAS_ANSWERS",
      "Soal tidak dapat dihapus karena sudah digunakan dalam riwayat pengerjaan.",
      409,
    );
  }

  await db.question.delete({ where: { id } });
  return Response.json({ deleted: true });
});
