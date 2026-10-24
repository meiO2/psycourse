import { clientIp, MENIT, readJson, tooManyAttempts, validationError, withErrors } from "@/lib/api";
import { issueOtp } from "@/lib/auth";
import { normalizeEmail } from "@/lib/auth/validation";
import { hit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { queueOtpEmail } from "@/lib/mail";

export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  if (!body) return validationError("Data tidak valid.");

  const email = normalizeEmail(body.email);
  const purpose = body.purpose;
  if (!email || (purpose !== "register" && purpose !== "recovery")) return validationError("Data tidak valid.");

  // Batas dihitung per email TANPA melihat apakah akunnya ada. Kalau 429 hanya muncul
  // untuk akun yang ada, endpoint ini bisa dipakai menebak email yang terdaftar.
  const byIp = await hit(`resend-ip:${clientIp(request)}`, 10, 15 * MENIT);
  if (byIp.limited) return tooManyAttempts(byIp.retryAfterSec);
  const byEmail = await hit(`resend:${email}`, 1, 60 * 1000);
  if (byEmail.limited) return tooManyAttempts(byEmail.retryAfterSec);

  const user = await db.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  const eligible = user && (purpose === "register" ? !user.emailVerified : !!user.emailVerified);
  if (eligible) {
    const otp = await issueOtp(user.id, purpose === "register" ? "OTP_VERIFIKASI_EMAIL" : "OTP_RESET_PASSWORD");
    if (otp.ok) queueOtpEmail(email, otp.code, purpose);
  }
  return Response.json({}, { status: 202 });
});
