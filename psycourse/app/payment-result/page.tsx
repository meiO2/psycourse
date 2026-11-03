"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, PageIntro } from "@/components/UI";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED" | "EXPIRED";

type Payment = {
  status: PaymentStatus;
  package: { nama: string };
};

function PaymentResultContent() {
  const params = useSearchParams();
  const paymentId = params.get("paymentId");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = paymentId ?? "";
    if (!id) return;

    let active = true;
    let attempts = 0;
    let retryTimer: number | undefined;

    async function loadPayment() {
      try {
        const response = await fetch(
          `/api/payments?paymentId=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        const result = await response.json();

        if (!active) return;
        if (!response.ok) {
          setError(result.error?.message || "Status pembayaran tidak dapat dimuat.");
          return;
        }

        const nextPayment = result.data as Payment;
        setPayment(nextPayment);
        if (nextPayment.status === "PENDING" && attempts < 5) {
          attempts += 1;
          retryTimer = window.setTimeout(loadPayment, 2000);
        }
      } catch {
        if (active) setError("Status pembayaran tidak dapat dimuat.");
      }
    }

    void loadPayment();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [paymentId]);

  const isPaid = payment?.status === "PAID";
  const isFailed =
    payment?.status === "FAILED" ||
    payment?.status === "CANCELED" ||
    payment?.status === "EXPIRED";

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <Link href="/dashboard">
            <Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55} />
          </Link>
          <Link className="text-link" href="/payment-history">
            Riwayat pembayaran
          </Link>
        </div>
      </header>
      <main className="app-main">
        <div className="container" style={{ maxWidth: 760 }}>
          <PageIntro
            eyebrow="STATUS PEMBAYARAN"
            title={
              isPaid
                ? "Pembayaran berhasil."
                : isFailed
                  ? "Pembayaran belum berhasil."
                  : "Pembayaran sedang diverifikasi."
            }
            description={
              isPaid
                ? "Pembayaran sudah dikonfirmasi. Akses paketmu telah dibuat."
                : isFailed
                  ? "Transaksi tidak dapat diselesaikan. Kamu dapat mencoba lagi."
                  : "Midtrans sudah mengembalikanmu ke PsyCourse. Status final akan diperbarui setelah notifikasi server diterima."
            }
          />
          <section className="panel-card center">
            {!paymentId || error ? (
              <div className="notice warning" role="alert">
                {error || "ID pembayaran tidak ditemukan."}
              </div>
            ) : payment ? (
              <>
                <h2>{payment.package.nama}</h2>
                <p style={{ color: "var(--muted)" }}>
                  Status: <strong>{payment.status}</strong>
                </p>
              </>
            ) : (
              <p style={{ color: "var(--muted)" }}>Memuat status pembayaran...</p>
            )}
            <div className="hero-actions" style={{ justifyContent: "center", marginTop: 24 }}>
              <Button href="/payment-history" variant="outline">Riwayat pembayaran</Button>
              <Button href={isPaid ? "/dashboard" : "/packages"}>
                {isPaid ? "Ke dashboard" : "Kembali ke paket"}
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function PaymentResultPage() {
  return <Suspense><PaymentResultContent /></Suspense>;
}
