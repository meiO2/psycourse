"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/UI";

type OfficialResult = {
  attemptId: string;
  status: "SELESAI" | "KEDALUWARSA";
  skor: number;
  totalSoal: number;
  persentase: number;
  expired: boolean;
  mulaiPada: string;
  deadlineAt: string | null;
  selesaiPada: string | null;
};

function ResultsContent() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<OfficialResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadResult() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/results/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.message || "Hasil tes belum dapat dimuat.");
        }
        if (!cancelled) setResult(data.result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil hasil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadResult();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <Link href="/dashboard"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link>
          <Link href="/history" className="text-link">Riwayat tes</Link>
        </div>
      </header>
      <main className="app-main">
        <div className="container" style={{ maxWidth: 760 }}>
          <section className="panel-card center" style={{ padding: 35 }}>
            {loading ? (
              <p style={{ color: "var(--muted)" }}>Mengambil hasil tes resmi...</p>
            ) : error ? (
              <>
                <h1 style={{ fontSize: 28 }}>Hasil belum tersedia</h1>
                <p role="alert" style={{ color: "var(--muted)", maxWidth: 500, margin: "12px auto 24px" }}>{error}</p>
                <div className="hero-actions" style={{ justifyContent: "center" }}>
                  <Button href="/dashboard" variant="outline">Kembali ke dashboard</Button>
                </div>
              </>
            ) : result ? (
              <>
                <span className="eyebrow">Hasil latihanmu</span>
                <div className="result-score">
                  <div>
                    <strong>{result.skor}/{result.totalSoal}</strong>
                    <span>JAWABAN BENAR</span>
                  </div>
                </div>
                <h1 style={{ fontSize: 32 }}>Bagus sudah menyelesaikan tes!</h1>
                <p style={{ color: "var(--muted)", maxWidth: 500, margin: "12px auto 24px" }}>
                  {result.expired
                    ? "Waktu tes sudah habis. Hasil dan jawaban yang tersimpan telah dihitung."
                    : "Hasil tes resmimu sudah dihitung dan disimpan oleh PsyCourse."}
                  {" "}Persentase: {result.persentase}%.
                </p>
                <div className="hero-actions" style={{ justifyContent: "center" }}>
                  <Button href="/history" variant="outline">Lihat riwayat tes</Button>
                  <Button href="/dashboard">Kembali ke dashboard →</Button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return <Suspense fallback={<div className="app-shell" />}><ResultsContent/></Suspense>;
}
