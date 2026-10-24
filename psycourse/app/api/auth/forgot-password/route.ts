import { clientIp, MENIT, readJson, tooManyAttempts, validationError, withErrors } from "@/lib/api";
import { issueOtp } from "@/lib/auth";
import { normalizeEmail } from "@/lib/auth/validation";
import { hit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { queueOtpEmail } from "@/lib/mail";

// Selalu 202 dengan isi sama, ada atau tidaknya akun tidak boleh terlihat dari respons.
export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return validationError("Format email tidak valid.");

  const limit = await hit(`forgot:${clientIp(request)}`, 5, 15 * MENIT);
  if (limit.limited) return tooManyAttempts(limit.retryAfterSec);

  const user = await db.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (user?.emailVerified) {
    const otp = await issueOtp(user.id, "OTP_RESET_PASSWORD");
    if (otp.ok) queueOtpEmail(email, otp.code, "recovery");
  }
  return Response.json({}, { status: 202 });
});
