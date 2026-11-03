import { publicUser, readJson, validationError, withErrors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBahasa, parseName } from "@/lib/auth/validation";
import { db } from "@/lib/db";

export const GET = withErrors(async () => {
  const user = await requireUser();
  // `akses` (paket aktif) diisi BE2 setelah modul pembayaran jadi.
  return Response.json({ ...publicUser(user), akses: null });
});

// Email sengaja tidak bisa diubah di versi 1 (lihat kontrak API bagian 3.2).
export const PATCH = withErrors(async (request) => {
  const user = await requireUser();
  const body = await readJson(request);
  if (!body) return validationError("Data tidak valid.");

  const data: { nama?: string; bahasa?: string } = {};
  if ("nama" in body) {
    const nama = parseName(body.nama);
    if (!nama) return validationError("Nama wajib diisi, maksimal 100 karakter.");
    data.nama = nama;
  }
  if ("bahasa" in body) {
    const bahasa = parseBahasa(body.bahasa);
    if (!bahasa) return validationError('Bahasa harus "id" atau "en".');
    data.bahasa = bahasa;
  }
  if (Object.keys(data).length === 0) return validationError("Tidak ada data yang diubah.");

  const updated = await db.user.update({ where: { id: user.id }, data });
  return Response.json({ ...publicUser(updated), akses: null });
});
