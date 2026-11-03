import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { PolicyStatus } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { parsePolicyContent, readPolicyContent, serializePolicyContent } from "@/lib/policy-content";

type RouteContext = { params: Promise<{ id: string }> };

function isPolicyStatus(value: string): value is PolicyStatus {
  return Object.values(PolicyStatus).some((status) => status === value);
}

export const PATCH = withErrors(async (request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return validationError("Data dokumen hukum tidak valid.");

  const current = await db.policy.findUnique({
    where: { id },
    select: { id: true, jenis: true, versi: true, status: true },
  });
  if (!current) return apiError("POLICY_NOT_FOUND", "Dokumen hukum tidak ditemukan.", 404);

  const data: { versi?: string; isi?: string | null; status?: PolicyStatus; terbitPada?: Date | null } = {};
  if ("version" in body) {
    if (typeof body.version !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$/.test(body.version.trim())) {
      return validationError("Versi wajib diisi (maksimal 50 karakter, hanya huruf, angka, titik, garis bawah, atau tanda hubung).");
    }
    const version = body.version.trim();
    if (version !== current.versi && current.jenis === "PRIVASI") {
      const consentCount = await db.consent.count({ where: { versi: current.versi } });
      if (consentCount > 0) {
        return apiError("POLICY_VERSION_IN_USE", "Versi Kebijakan Privasi sudah menjadi bukti persetujuan dan tidak dapat diubah.", 409);
      }
    }
    data.versi = version;
  }
  if ("content" in body) {
    const content = readPolicyContent(body.content);
    if (!content) return validationError("Isi dokumen harus berupa teks Bahasa Indonesia dan English (maksimal 100.000 karakter per bahasa).");
    data.isi = serializePolicyContent(content);
  }
  if ("status" in body) {
    if (typeof body.status !== "string" || !isPolicyStatus(body.status)) {
      return validationError("Status dokumen tidak valid.");
    }
    data.status = body.status;
  }
  if (Object.keys(data).length === 0) return validationError("Tidak ada perubahan dokumen.");

  const nextStatus = data.status ?? current.status;
  if (nextStatus === PolicyStatus.TERBIT) {
    const existing = data.isi === undefined
      ? await db.policy.findUnique({ where: { id }, select: { isi: true } })
      : null;
    const content = data.isi === undefined
      ? parsePolicyContent(existing?.isi ?? null)
      : parsePolicyContent(data.isi);
    if (!content.id || !content.en) {
      return validationError("Isi dokumen dalam Bahasa Indonesia dan English wajib tersedia sebelum diterbitkan.");
    }
    if (current.status !== PolicyStatus.TERBIT) data.terbitPada = new Date();
  } else if (current.status === PolicyStatus.TERBIT) {
    data.terbitPada = null;
  }

  try {
    const updated = await db.$transaction(async (transaction) => {
      if (nextStatus === PolicyStatus.TERBIT) {
        await transaction.policy.updateMany({
          where: { jenis: current.jenis, status: PolicyStatus.TERBIT, NOT: { id } },
          data: { status: PolicyStatus.DITINJAU },
        });
      }
      return transaction.policy.update({
        where: { id },
        data,
        select: { id: true },
      });
    });
    return Response.json(updated);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return apiError("POLICY_VERSION_EXISTS", "Versi tersebut sudah ada untuk jenis dokumen ini.", 409);
    }
    throw error;
  }
});

export const DELETE = withErrors(async (_request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const policy = await db.policy.findUnique({
    where: { id },
    select: { id: true, jenis: true, versi: true },
  });
  if (!policy) return apiError("POLICY_NOT_FOUND", "Dokumen hukum tidak ditemukan.", 404);

  if (policy.jenis === "PRIVASI") {
    const consentCount = await db.consent.count({ where: { versi: policy.versi } });
    if (consentCount > 0) {
      return apiError("POLICY_VERSION_IN_USE", "Dokumen tidak dapat dihapus karena versinya sudah menjadi bukti persetujuan pengguna.", 409);
    }
  }

  await db.policy.delete({ where: { id } });
  return Response.json({ deleted: true });
});
