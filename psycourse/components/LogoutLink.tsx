"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/client-api";

// Tautan "Keluar": menghapus sesi di server, lalu pindah ke halaman login.
// Tetap berupa <a> supaya tampilannya sama dengan tautan lain di sekitarnya.
export default function LogoutLink({ children, className, redirectTo = "/login" }: { children: ReactNode; className?: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <a
      href={redirectTo}
      className={className}
      onClick={async (event) => {
        event.preventDefault();
        await api("/api/auth/logout", "POST");
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {children}
    </a>
  );
}
