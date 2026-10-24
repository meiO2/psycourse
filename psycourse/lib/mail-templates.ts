import { OTP_TTL_MS } from "@/lib/auth/constants";

export type OtpPurpose = "register" | "recovery";

export type OtpEmail = { subject: string; text: string; html: string };

// Isi email OTP. Sengaja tidak memuat data dari pengguna (nama, dll.), jadi tidak ada
// celah menyisipkan HTML ke email. Satu-satunya nilai variabel adalah kode 6 digit.
export function buildOtpEmail(code: string, purpose: OtpPurpose): OtpEmail {
  if (!/^\d{6}$/.test(code)) throw new Error("Kode OTP harus 6 digit angka.");

  const menit = Math.round(OTP_TTL_MS / 60000);
  const subject =
    purpose === "register"
      ? `${code} adalah kode verifikasi PsyCourse-mu`
      : `${code} adalah kode reset kata sandi PsyCourse-mu`;
  const intro =
    purpose === "register"
      ? "Terima kasih sudah mendaftar di PsyCourse. Gunakan kode berikut untuk memverifikasi emailmu:"
      : "Kami menerima permintaan untuk mengatur ulang kata sandi akun PsyCourse-mu. Gunakan kode berikut:";
  const warning = `Kode berlaku ${menit} menit dan hanya bisa dipakai sekali. Jangan bagikan kode ini kepada siapa pun, termasuk yang mengaku dari PsyCourse.`;
  const ignore = "Jika kamu tidak merasa memintanya, abaikan email ini. Akunmu tetap aman.";

  const text = `Halo,\n\n${intro}\n\n${code}\n\n${warning}\n\n${ignore}\n\nTim PsyCourse\n`;

  const html = `<!doctype html>
<html lang="id"><body style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#1c2b24">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<div style="font-size:20px;font-weight:700;color:#0EBB5A;margin-bottom:20px">PsyCourse</div>
<p style="margin:0 0 20px;line-height:1.5">${intro}</p>
<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#BDECD1;border-radius:8px;padding:16px;margin:0 0 20px">${code}</div>
<p style="margin:0 0 12px;line-height:1.5;font-size:14px">${warning}</p>
<p style="margin:0;line-height:1.5;font-size:14px;color:#5b6b63">${ignore}</p>
</div></body></html>`;

  return { subject, text, html };
}
