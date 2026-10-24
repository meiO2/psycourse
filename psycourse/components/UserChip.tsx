"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

type Me = { nama: string };

// Chip nama pengguna di dashboard. Nama diambil dari /api/me; kalau sesi tidak valid
// (cookie kedaluwarsa atau dihapus), pengguna diarahkan ke /login.
export default function UserChip() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let batal = false;
    api<Me>("/api/me", "GET").then((hasil) => {
      if (batal) return;
      if (hasil.status === 401) router.replace("/login");
      else if (hasil.data) setMe(hasil.data);
    });
    return () => {
      batal = true;
    };
  }, [router]);

  const namaDepan = me?.nama.split(" ")[0] ?? "";
  return (
    <Link href="/settings" className="user-chip profile-link" aria-label="Buka pengaturan akun">
      <span className="user-avatar">{namaDepan.charAt(0).toUpperCase() || "·"}</span>
      <span>
        <span style={{ display: "block" }}>{namaDepan ? `Halo, ${namaDepan}` : "Halo!"}</span>
        <small style={{ color: "var(--muted)", fontWeight: 500 }}>Pengaturan akun ↗</small>
      </span>
    </Link>
  );
}
