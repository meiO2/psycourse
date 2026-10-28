import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, readJson, withErrors } from "@/lib/api";

export const POST = withErrors(async (request) => {
  const user = await requireUser();
  const body = await readJson(request);
  if (!body || typeof body.testId !== "string" || typeof body.score !== "number" || typeof body.totalSoal !== "number" || !Number.isSafeInteger(body.score) || !Number.isSafeInteger(body.totalSoal)) {
    return apiError("VALIDATION_ERROR", "Data hasil tes tidak valid.", 400);
  }

  const test = await db.test.findFirst({ where: { OR: [{ id: body.testId }, { slug: body.testId }], status: "AKTIF" }, select: { id: true } });
  if (!test) return apiError("TEST_NOT_FOUND", "Tes tidak ditemukan.", 404);

  const existing = await db.attempt.findFirst({
    where: { userId: user.id, testId: test.id, status: { in: ["SELESAI", "KEDALUWARSA"] }, selesaiPada: { not: null } },
    orderBy: { selesaiPada: "desc" },
    select: { id: true },
  });
  if (existing) return Response.json({ data: { id: existing.id, alreadyRecorded: true } });

  const attempt = await db.attempt.create({
    data: { userId: user.id, testId: test.id, status: "SELESAI", skor: Math.max(0, body.score), totalSoal: Math.max(1, body.totalSoal), selesaiPada: new Date() },
    select: { id: true },
  });
  return Response.json({ data: { id: attempt.id, alreadyRecorded: false } }, { status: 201 });
});
