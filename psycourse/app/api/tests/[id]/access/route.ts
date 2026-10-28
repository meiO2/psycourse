import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, withErrors } from "@/lib/api";

export const GET = withErrors(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context!.params;
  const test = await db.test.findFirst({
    where: { OR: [{ id }, { slug: id }], status: "AKTIF" },
    select: { id: true, tipe: true },
  });

  if (!test) return apiError("TEST_NOT_FOUND", "Tes tidak ditemukan.", 404);
  if (test.tipe === "TEST_1") return Response.json({ data: { allowed: true } });

  const allowed = await db.entitlement.findFirst({
    where: {
      userId: user.id,
      OR: [
        { packageId: "premium" },
        { packageId: "single", testId: test.id },
      ],
      AND: [{ OR: [{ berakhir: null }, { berakhir: { gt: new Date() } }] }],
    },
    select: { id: true },
  });

  return Response.json({ data: { allowed: Boolean(allowed) } });
});
