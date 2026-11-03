import { apiError, MENIT, readJson, tooManyAttempts, validationError, withErrors } from "@/lib/api";
import { destroySession, requireUser, verifyPassword } from "@/lib/auth";
import { hit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";

// PDP-04: penghapusan akun atas permintaan pengguna. Tabel yang menyimpan data pengguna
// memakai onDelete: Cascade, jadi sesi, token, persetujuan, pembayaran, hak akses, dan hasil
// tes ikut terhapus. AccessLog sengaja tidak ikut (log audit, tanpa relasi ke User).
export const DELETE = withErrors(async (request) => {
  const user = await requireUser();
  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return validationError("Masukkan kata sandi untuk konfirmasi.");

  // Kata sandi diminta ulang: sesi yang tertinggal di perangkat orang lain tidak boleh
  // cukup untuk menghapus akun. Dibatasi supaya tidak bisa dipakai menebak kata sandi.
  const limit = await hit(`delete-account:${user.id}`, 5, 15 * MENIT);
  if (limit.limited) return tooManyAttempts(limit.retryAfterSec);

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return apiError("INVALID_CREDENTIALS", "Kata sandi salah.", 401);
  }

  await destroySession();
  await db.user.delete({ where: { id: user.id } });
  return new Response(null, { status: 204 });
});
