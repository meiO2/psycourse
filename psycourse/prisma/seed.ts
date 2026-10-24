// Data contoh untuk lokal dan staging. Mengambil data dummy yang disiapkan FE di
// lib/data.ts, jadi satu sumber: kalau FE mengubah dummy, jalankan seed lagi.
//
// Aman dijalankan berulang (upsert). Tidak berisi data pribadi (PDP-06).
// Jalankan: npx prisma db seed
//
// Akun demo (satu siswa, satu admin) ikut dibuat, dengan kata sandi yang di-hash seperti
// akun asli. Kata sandinya dari SEED_DEMO_PASSWORD. Di produksi, akun demo TIDAK dibuat
// kecuali variabel itu diisi dengan sengaja.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type TestType } from "../lib/generated/prisma/client";
import { categories, packages, sampleQuestions } from "../lib/data";
import { hashPassword } from "../lib/auth/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum diisi. Salin .env.example menjadi .env.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Pola slug tes mengikuti URL di UI: /tests/logika-test-1, -test-2, -practice
const testDefs: { suffix: string; tipe: TestType; timerDetik: number | null }[] = [
  { suffix: "test-1", tipe: "TEST_1", timerDetik: null },
  { suffix: "test-2", tipe: "TEST_2", timerDetik: 600 }, // 10 menit, sama dengan timer demo di UI
  { suffix: "practice", tipe: "PRACTICE", timerDetik: null },
];

// Harga paket gratis/sekali beli tidak berbatas waktu; Premium 30 hari (sesuai lib/data.ts)
const durasiHari: Record<string, number | null> = { free: null, single: null, premium: 30 };

const demoUsers = [
  { email: "siswa.demo@example.com", nama: "Mei", role: "USER" as const },
  { email: "admin.demo@example.com", nama: "Admin Demo", role: "ADMIN" as const },
];

async function seedDemoUsers() {
  const password = process.env.SEED_DEMO_PASSWORD || (process.env.NODE_ENV === "production" ? undefined : "demo-password-123");
  if (!password) {
    console.log("Akun demo dilewati: SEED_DEMO_PASSWORD tidak diisi di produksi.");
    return;
  }
  const passwordHash = await hashPassword(password);
  for (const u of demoUsers) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { nama: u.nama, role: u.role, passwordHash, emailVerified: new Date() },
      create: { email: u.email, nama: u.nama, role: u.role, passwordHash, emailVerified: new Date() },
    });
    if ((await db.consent.count({ where: { userId: user.id } })) === 0) {
      await db.consent.create({ data: { userId: user.id, versi: "draft-1" } });
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`Akun demo (kata sandi: ${password}): ${demoUsers.map((u) => `${u.email} [${u.role}]`).join(", ")}`);
  }
}

async function main() {
  for (const [i, c] of categories.entries()) {
    const category = await db.category.upsert({
      where: { slug: c.slug },
      update: { judul: c.title, subjudul: c.subtitle, ikon: c.icon, warna: c.color, deskripsi: c.description, urutan: i },
      create: { slug: c.slug, judul: c.title, subjudul: c.subtitle, ikon: c.icon, warna: c.color, deskripsi: c.description, urutan: i },
    });

    for (const t of testDefs) {
      await db.test.upsert({
        where: { slug: `${c.slug}-${t.suffix}` },
        update: { tipe: t.tipe, timerDetik: t.timerDetik },
        create: { categoryId: category.id, slug: `${c.slug}-${t.suffix}`, tipe: t.tipe, timerDetik: t.timerDetik },
      });
    }
  }

  for (const [i, p] of packages.entries()) {
    const data = {
      nama: p.name,
      harga: p.price,
      labelDurasi: p.duration,
      durasiHari: durasiHari[p.id] ?? null,
      unggulan: p.featured,
      deskripsi: p.description,
      fitur: p.features,
      urutan: i,
    };
    await db.package.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
  }

  // UI memakai 5 soal contoh yang sama untuk semua tes. Di database cukup ditaruh
  // di logika-test-1 sebagai placeholder berstatus DRAFT, supaya tidak dianggap
  // soal resmi. Bank soal asli (100 soal resmi + latihan) diisi tim lewat panel admin.
  const logikaTest1 = await db.test.findUniqueOrThrow({ where: { slug: "logika-test-1" } });
  for (const [i, q] of sampleQuestions.entries()) {
    const data = {
      teks: q.question,
      pilihan: q.choices,
      kunciJawaban: q.answer,
      penjelasan: q.explanation,
      dibuatDengan: "Placeholder FE (lib/data.ts)",
    };
    await db.question.upsert({
      where: { testId_urutan: { testId: logikaTest1.id, urutan: i + 1 } },
      update: data,
      create: { testId: logikaTest1.id, urutan: i + 1, ...data },
    });
  }

  await seedDemoUsers();

  // Sama dengan baris di halaman admin: Draft 1, perlu tinjauan
  for (const jenis of ["PRIVASI", "KETENTUAN"] as const) {
    await db.policy.upsert({
      where: { jenis_versi: { jenis, versi: "draft-1" } },
      update: {},
      create: { jenis, versi: "draft-1", status: "DRAFT" },
    });
  }
}

main()
  .then(async () => {
    const [c, t, p, q, pol] = await Promise.all([
      db.category.count(), db.test.count(), db.package.count(), db.question.count(), db.policy.count(),
    ]);
    console.log(`Seed selesai: ${c} kategori, ${t} tes, ${p} paket, ${q} soal, ${pol} kebijakan.`);
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
