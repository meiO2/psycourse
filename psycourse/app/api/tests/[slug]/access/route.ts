import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, withErrors } from "@/lib/api";
import { canAccessTest } from "@/lib/access/test-access-service";

export const GET = withErrors(async (_request, context) => {
  const user = await requireUser();
  const { slug } = await context!.params;
  const test = await db.test.findFirst({
    where: { OR: [{ id: slug }, { slug }], status: "AKTIF" },
    select: { id: true, tipe: true },
  });

  if (!test) return apiError("TEST_NOT_FOUND", "Tes tidak ditemukan.", 404);
  return Response.json({ data: { allowed: await canAccessTest(user.id, test) } });
});
