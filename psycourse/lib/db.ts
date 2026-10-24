import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Satu PrismaClient dipakai bersama seluruh aplikasi: tiap instance membuka
// connection pool sendiri. Saat `next dev`, modul ini dimuat ulang tiap kali
// kode berubah, jadi instance disimpan di globalThis agar tidak menumpuk.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diisi. Salin .env.example menjadi .env.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
