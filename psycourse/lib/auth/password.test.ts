import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword, verifyPasswordOrDummy } from "./password";

describe("password", () => {
  it("hash tidak sama dengan kata sandi asli dan berformat bcrypt", async () => {
    const hash = await hashPassword("kata-sandi-benar");
    expect(hash).not.toContain("kata-sandi-benar");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("kata sandi yang sama menghasilkan hash berbeda (ada salt)", async () => {
    expect(await hashPassword("sama-saja")).not.toBe(await hashPassword("sama-saja"));
  });

  it("verifyPassword benar untuk kata sandi yang cocok, salah untuk yang lain", async () => {
    const hash = await hashPassword("kata-sandi-benar");
    expect(await verifyPassword("kata-sandi-benar", hash)).toBe(true);
    expect(await verifyPassword("kata-sandi-salah", hash)).toBe(false);
  });

  it("verifyPasswordOrDummy selalu false kalau hash tidak ada (email tidak terdaftar)", async () => {
    expect(await verifyPasswordOrDummy("apa-saja", null)).toBe(false);
    expect(await verifyPasswordOrDummy("apa-saja", undefined)).toBe(false);
  });

  it("verifyPasswordOrDummy memakai hash asli kalau ada", async () => {
    const hash = await hashPassword("kata-sandi-benar");
    expect(await verifyPasswordOrDummy("kata-sandi-benar", hash)).toBe(true);
  });

  describe("validatePassword", () => {
    it("menolak kurang dari 8 karakter", () => {
      expect(validatePassword("1234567")).not.toBeNull();
    });
    it("menerima 8 karakter", () => {
      expect(validatePassword("12345678")).toBeNull();
    });
    it("menerima tepat 72 byte, menolak 73 byte (batas bcrypt)", () => {
      expect(validatePassword("a".repeat(72))).toBeNull();
      expect(validatePassword("a".repeat(73))).not.toBeNull();
    });
    it("menghitung byte, bukan karakter (emoji = 4 byte)", () => {
      expect(validatePassword("😀".repeat(18))).toBeNull(); // 72 byte
      expect(validatePassword("😀".repeat(19))).not.toBeNull(); // 76 byte
    });
  });
});
