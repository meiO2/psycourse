import { apiError, clientIp, MENIT, readJson, tooManyAttempts, validationError, withErrors } from "@/lib/api";
import { consumeResetToken, destroyAllSessions, hashPassword, validatePassword } from "@/lib/auth";
import { hit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";

export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  const resetToken = typeof body?.resetToken === "string" ? body.resetToken : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!body || !resetToken) return validationError("Data tidak valid.");

  const limit = await hit(`reset:${clientIp(request)}`, 10, 15 * MENIT);
  if (limit.limited) return tooManyAttempts(limit.retryAfterSec);

  // Kata sandi dicek SEBELUM token dipakai, supaya pengguna yang salah ketik kata sandi
  // pendek tidak kehilangan token dan harus mengulang dari OTP.
  const passwordError = validatePassword(password);
  if (passwordError) return validationError(passwordError);

  const userId = await consumeResetToken(resetToken);
  if (!userId) return apiError("OTP_INVALID", "Tautan reset salah atau sudah kedaluwarsa.", 400);

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  // Semua perangkat harus login ulang dengan kata sandi baru.
  await destroyAllSessions(userId);
  return new Response(null, { status: 204 });
});
