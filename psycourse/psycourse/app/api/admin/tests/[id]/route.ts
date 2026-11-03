import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { ContentStatus, TestType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function isContentStatus(value: string): value is ContentStatus {
  return Object.values(ContentStatus).some((status) => status === value);
}

export const PATCH = withErrors(async (request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return validationError("Data versi tes tidak valid.");

  const test = await db.test.findUnique({
    where: { id },
    select: { id: true, tipe: true },
  });
  if (!test) return apiError("TEST_NOT_FOUND", "Versi tes tidak ditemukan.", 404);

  const data: { status?: ContentStatus; timerDetik?: number | null } = {};
  if ("status" in body) {
    if (typeof body.status !== "string" || !isContentStatus(body.status)) {
      return validationError("Status harus Draft, Aktif, atau Nonaktif.");
    }
    data.status = body.status;
  }
  if ("timerSeconds" in body) {
    if (test.tipe !== TestType.TEST_2) {
      return validationError("Timer hanya dapat diatur untuk Test 2.");
    }
    if (body.timerSeconds === null || body.timerSeconds === "") {
      data.timerDetik = null;
    } else if (
      typeof body.timerSeconds !== "number" ||
      !Number.isInteger(body.timerSeconds) ||
      body.timerSeconds < 60 ||
      body.timerSeconds > 86400
    ) {
      return validationError("Durasi Test 2 harus 60–86.400 detik, atau kosongkan untuk tanpa timer.");
    } else {
      data.timerDetik = body.timerSeconds;
    }
  }
  if (Object.keys(data).length === 0) return validationError("Tidak ada konfigurasi yang diubah.");

  const updated = await db.test.update({
    where: { id },
    data,
    select: { id: true, status: true, timerDetik: true },
  });
  return Response.json(updated);
});

export const DELETE = withErrors(async (_request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const test = await db.test.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { attempts: true } },
    },
  });
  if (!test) return apiError("TEST_NOT_FOUND", "Versi tes tidak ditemukan.", 404);
  if (test._count.attempts > 0) {
    return apiError(
      "TEST_HAS_ATTEMPTS",
      "Versi tes tidak dapat dihapus karena sudah memiliki riwayat pengerjaan. Ubah statusnya menjadi Nonaktif.",
      409,
    );
  }

  await db.$transaction(async (transaction) => {
    await transaction.question.deleteMany({ where: { testId: id } });
    await transaction.test.delete({ where: { id } });
  });

  return Response.json({ deleted: true });
});
