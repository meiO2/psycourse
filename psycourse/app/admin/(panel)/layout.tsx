import { connection } from "next/server";
import { requirePageAdmin } from "@/lib/auth";

// Semua halaman admin (kecuali /admin = login admin) hanya untuk ADMIN. Non-admin dan
// sesi palsu dialihkan ke /admin.
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await requirePageAdmin();
  return children;
}
