import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { PolicyStatus, PolicyType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { parsePolicyContent, readPolicyContent, serializePolicyContent } from "@/lib/policy-content";

const typeLabels: Record<PolicyType, string> = {
  [PolicyType.PRIVASI]: "Kebijakan Privasi",
  [PolicyType.KETENTUAN]: "Ketentuan Layanan",
};

const statusLabels: Record<PolicyStatus, string> = {
  [PolicyStatus.DRAFT]: "Draft",
  [PolicyStatus.DITINJAU]: "Perlu tinjauan",
  [PolicyStatus.TERBIT]: "Terbit",
};

function isPolicyType(value: string): value is PolicyType {
  return Object.values(PolicyType).some((type) => type === value);
}

function isPolicyStatus(value: string): value is PolicyStatus {
  return Object.values(PolicyStatus).some((status) => status === value);
}

export const GET = withErrors(async () => {
  await requireAdmin();
  const policies = await db.policy.findMany({
    orderBy: [{ jenis: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      jenis: true,
      versi: true,
      status: true,
      isi: true,
      terbitPada: true,
      updatedAt: true,
    },
  });

  return Response.json({
    policies: policies.map((policy) => {
      const content = parsePolicyContent(policy.isi);
      return {
        id: policy.id,
        jenis: policy.jenis,
        versi: policy.versi,
        status: policy.status,
        contentId: content.id,
        contentEn: content.en,
        terbitPada: policy.terbitPada,
        updatedAt: policy.updatedAt,
        typeLabel: typeLabels[policy.jenis],
        statusLabel: statusLabels[policy.status],
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = withErrors(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!body) return validationError("Data dokumen hukum tidak valid.");

  const type = typeof body.type === "string" ? body.type : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";
  const content = readPolicyContent(body.content);
  const rawStatus = typeof body.status === "string" ? body.status : PolicyStatus.DRAFT;

  if (!isPolicyType(type)) return validationError("Jenis dokumen hukum tidak valid.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$/.test(version)) {
    return validationError("Versi wajib diisi (maksimal 50 karakter, hanya huruf, angka, titik, garis bawah, atau tanda hubung).");
  }
  if (!content) return validationError("Isi dokumen harus berupa teks Bahasa Indonesia dan English (maksimal 100.000 karakter per bahasa).");
  if (!isPolicyStatus(rawStatus)) return validationError("Status dokumen tidak valid.");
  if (rawStatus === PolicyStatus.TERBIT && (!content.id || !content.en)) {
    return validationError("Isi dokumen dalam Bahasa Indonesia dan English wajib tersedia sebelum diterbitkan.");
  }

  try {
    const policy = await db.$transaction(async (transaction) => {
      if (rawStatus === PolicyStatus.TERBIT) {
        await transaction.policy.updateMany({
          where: { jenis: type, status: PolicyStatus.TERBIT },
          data: { status: PolicyStatus.DITINJAU },
        });
      }
      return transaction.policy.create({
        data: {
          jenis: type,
          versi: version,
          status: rawStatus,
          isi: serializePolicyContent(content),
          terbitPada: rawStatus === PolicyStatus.TERBIT ? new Date() : null,
        },
        select: { id: true },
      });
    });
    return Response.json({ id: policy.id }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return apiError("POLICY_VERSION_EXISTS", "Versi tersebut sudah ada untuk jenis dokumen ini.", 409);
    }
    throw error;
  }
});
