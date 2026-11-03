import { apiError, clientIp, MENIT, publicUser, readJson, tooManyAttempts, validationError, withErrors } from "@/lib/api";
import { createSession, issueResetToken, verifyOtp } from "@/lib/auth";
import { normalizeEmail, parseOtpCode } from "@/lib/auth/validation";
import { hit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";

// Semua kegagalan memakai pesan yang sama: salah, kedaluwarsa, sudah dipakai, atau akun
// tidak ada, tidak dibedakan (kontrak: OTP_INVALID).
const invalid = () => apiError("OTP_INVALID", "Kode salah atau sudah kedaluwarsa.", 400);

export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  if (!body) return validationError("Data tidak valid.");

  const email = normalizeEmail(body.email);
  const code = parseOtpCode(body.code);
  const purpose = body.purpose;
  if (!email || !code || (purpose !== "register" && purpose !== "recovery")) {
    return validationError("Data tidak valid.");
  }

  const limit = await hit(`verify-otp:${clientIp(request)}`, 20, 15 * MENIT);
  if (limit.limited) return tooManyAttempts(limit.retryAfterSec);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return invalid();

  if (purpose === "register") {
    if (user.emailVerified) return invalid();
    if (!(await verifyOtp(user.id, "OTP_VERIFIKASI_EMAIL", code))) return invalid();

    const verified = await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    await createSession(verified.id);
    return Response.json({ user: publicUser(verified) });
  }

  if (!user.emailVerified) return invalid();
  if (!(await verifyOtp(user.id, "OTP_RESET_PASSWORD", code))) return invalid();
  return Response.json({ resetToken: await issueResetToken(user.id) });
});
