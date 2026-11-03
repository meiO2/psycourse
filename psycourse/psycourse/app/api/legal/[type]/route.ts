import { PolicyStatus, PolicyType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { apiError, withErrors } from "@/lib/api";
import { parsePolicyContent } from "@/lib/policy-content";

type RouteContext = { params: Promise<{ type: string }> };

export const GET = withErrors(async (_request, { params }: RouteContext) => {
  const { type } = await params;
  const policyType = type === "privacy"
    ? PolicyType.PRIVASI
    : type === "terms"
      ? PolicyType.KETENTUAN
      : null;
  if (!policyType) return apiError("POLICY_NOT_FOUND", "Dokumen hukum tidak ditemukan.", 404);

  const policy = await db.policy.findFirst({
    where: { jenis: policyType, status: PolicyStatus.TERBIT, isi: { not: null } },
    orderBy: { terbitPada: "desc" },
    select: { versi: true, isi: true, terbitPada: true },
  });
  if (!policy) return apiError("POLICY_NOT_PUBLISHED", "Belum ada dokumen hukum yang diterbitkan.", 404);

  return Response.json({
    version: policy.versi,
    ...parsePolicyContent(policy.isi),
    publishedAt: policy.terbitPada,
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
});
