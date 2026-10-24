import { describe, expect, it } from "vitest";
import { buildOtpEmail } from "./mail-templates";

describe("buildOtpEmail", () => {
  it("kode ada di subjek, teks, dan HTML", () => {
    const mail = buildOtpEmail("042913", "register");
    expect(mail.subject).toContain("042913");
    expect(mail.text).toContain("042913");
    expect(mail.html).toContain("042913");
  });

  it("menyebut masa berlaku 10 menit dan peringatan jangan dibagikan", () => {
    const mail = buildOtpEmail("123456", "register");
    expect(mail.text).toContain("10 menit");
    expect(mail.text).toMatch(/Jangan bagikan/);
  });

  it("teks berbeda untuk registrasi dan reset kata sandi", () => {
    const daftar = buildOtpEmail("123456", "register");
    const reset = buildOtpEmail("123456", "recovery");
    expect(daftar.subject).toContain("verifikasi");
    expect(reset.subject).toContain("reset kata sandi");
    expect(daftar.text).not.toBe(reset.text);
  });

  it("menolak kode yang bukan 6 digit angka (mencegah penyisipan HTML)", () => {
    expect(() => buildOtpEmail("12345", "register")).toThrow();
    expect(() => buildOtpEmail("1234567", "register")).toThrow();
    expect(() => buildOtpEmail("12345a", "register")).toThrow();
    expect(() => buildOtpEmail("<b>123</b>", "register")).toThrow();
  });
});
