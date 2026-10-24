import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { after } from "next/server";
import { buildOtpEmail, type OtpPurpose } from "@/lib/mail-templates";

// Pengiriman email lewat SMTP, jadi penyedia apa pun bisa dipakai (Mailpit untuk lokal,
// Gmail/Brevo/Resend/SES untuk staging dan produksi). Diatur lewat variabel di .env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
// Tanpa SMTP_HOST:
//  - lokal: kode OTP dicetak ke log server supaya alur tetap bisa dicoba.
//  - produksi: pengiriman gagal dengan error jelas, lebih baik terlihat daripada OTP
//    diam-diam tidak pernah terkirim.

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS langsung; port lain naik ke TLS lewat STARTTLS
    requireTLS: process.env.NODE_ENV === "production", // produksi tidak boleh mengirim tanpa enkripsi
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

function mailFrom(): string {
  const from = process.env.MAIL_FROM;
  if (from) return from;
  if (process.env.NODE_ENV === "production") throw new Error("MAIL_FROM belum diisi.");
  return "PsyCourse <no-reply@localhost>";
}

export async function sendOtpEmail(to: string, code: string, purpose: OtpPurpose): Promise<void> {
  const mail = buildOtpEmail(code, purpose);

  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_HOST belum diisi.");
    console.info(`[DEV EMAIL] ke=${to} untuk=${purpose === "register" ? "verifikasi email" : "reset kata sandi"} kode=${code}`);
    return;
  }

  await getTransporter().sendMail({ from: mailFrom(), to, subject: mail.subject, text: mail.text, html: mail.html });
}

// Dipakai oleh Route Handler. Email dikirim SETELAH respons dikirim ke klien, karena:
//  1. Lama respons tidak membocorkan akun. Email hanya dikirim untuk akun yang ada, dan
//     mengirim butuh waktu; kalau ditunggu, penyerang bisa membedakan email terdaftar dari
//     yang tidak hanya lewat selisih waktu respons.
//  2. Pengguna tidak menunggu SMTP yang lambat.
// Kegagalan hanya dicatat (tanpa kode OTP dan tanpa alamat email); pengguna bisa meminta
// kode baru lewat "Kirim ulang".
export function queueOtpEmail(to: string, code: string, purpose: OtpPurpose): void {
  after(async () => {
    try {
      await sendOtpEmail(to, code, purpose);
    } catch (error) {
      console.error("[mail] gagal mengirim email OTP:", error instanceof Error ? error.message : error);
    }
  });
}
