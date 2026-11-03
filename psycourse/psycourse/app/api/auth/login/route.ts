import { apiError, clientIp, MENIT, publicUser, readJson, tooManyAttempts, withErrors } from "@/lib/api";
import { createSession, issueOtp, verifyPasswordOrDummy } from "@/lib/auth";
import { normalizeEmail } from "@/lib/auth/validation";
import { check, hit, reset } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { queueOtpEmail } from "@/lib/mail";

const MAX_GAGAL = 5;
const JENDELA = 15 * MENIT;

// Satu pesan untuk email tidak terdaftar maupun kata sandi salah (SEC-10).
const invalidCredentials = () => apiError("INVALID_CREDENTIALS", "Email atau kata sandi salah.", 401);

// Dipakai oleh /login dan /admin. Halaman admin memeriksa `role` di respons; pemeriksaan
// sebenarnya tetap dilakukan server di tiap halaman dan endpoint admin lewat requireAdmin().
export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!body || !email || !password) return invalidCredentials();

  // SEC-08: setelah 5 kali gagal dalam 15 menit untuk kombinasi IP + email, diblokir sementara.
  const key = `login:${clientIp(request)}:${email}`;
  const state = await check(key, MAX_GAGAL, JENDELA);
  if (state.limited) return tooManyAttempts(state.retryAfterSec);

  const user = await db.user.findUnique({ where: { email } });
  const passwordOk = await verifyPasswordOrDummy(password, user?.passwordHash);
  if (!user || !passwordOk) {
    await hit(key, MAX_GAGAL, JENDELA);
    return invalidCredentials();
  }

  if (!user.emailVerified) {
    // Kata sandi benar tapi belum verifikasi: kirim kode baru supaya FE bisa langsung ke /verify-otp.
    const otp = await issueOtp(user.id, "OTP_VERIFIKASI_EMAIL");
    if (otp.ok) queueOtpEmail(email, otp.code, "register");
    return apiError("EMAIL_NOT_VERIFIED", "Email belum diverifikasi. Masukkan kode yang kami kirim ke emailmu.", 403);
  }

  await reset(key);
  await createSession(user.id, body.rememberMe === true);
  return Response.json({ user: publicUser(user) });
});
