import { clientIp, MENIT, readJson, tooManyAttempts, validationError, withErrors } from "@/lib/api";
import { hashPassword, issueOtp, validatePassword } from "@/lib/auth";
import { normalizeEmail, parseName } from "@/lib/auth/validation";
import { hit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { queueOtpEmail } from "@/lib/mail";

// Respons sama persis untuk email baru maupun yang sudah terdaftar, supaya endpoint ini
// tidak bisa dipakai untuk menebak email siapa saja yang punya akun.
const accepted = () => Response.json({ verificationRequired: true }, { status: 202 });

export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  if (!body) return validationError("Data tidak valid.");

  const limit = await hit(`register:${clientIp(request)}`, 5, 60 * MENIT);
  if (limit.limited) return tooManyAttempts(limit.retryAfterSec);

  const nama = parseName(body.name);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!nama) return validationError("Nama wajib diisi, maksimal 100 karakter.");
  if (!email) return validationError("Format email tidak valid.");
  const passwordError = validatePassword(password);
  if (passwordError) return validationError(passwordError);
  if (body.privacyConsent !== true) return validationError("Kamu harus menyetujui Kebijakan Privasi.");

  // Selalu di-hash walau email sudah terdaftar, supaya lama respons tidak membocorkannya.
  const passwordHash = await hashPassword(password);

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (existing?.emailVerified) return accepted();

  const privacy = await db.policy.findFirst({ where: { jenis: "PRIVASI" }, orderBy: { createdAt: "desc" } });
  const versi = privacy?.versi ?? "draft-1";

  let userId: string;
  try {
    // Pendaftar yang belum verifikasi boleh mendaftar ulang; data lamanya diperbarui.
    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { nama, passwordHash } })
      : await db.user.create({ data: { email, nama, passwordHash } });
    userId = user.id;
  } catch (error) {
    // Dua pendaftaran bersamaan dengan email sama: yang kalah tidak perlu error.
    if ((error as { code?: string }).code === "P2002") return accepted();
    throw error;
  }

  await db.consent.create({ data: { userId, versi } });

  const otp = await issueOtp(userId, "OTP_VERIFIKASI_EMAIL");
  if (otp.ok) queueOtpEmail(email, otp.code, "register");
  return accepted();
});
