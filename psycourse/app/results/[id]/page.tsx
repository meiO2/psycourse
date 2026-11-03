"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/UI";
import { sampleQuestions } from "@/lib/data";

const subscribeNone = () => () => {};
function useLastResult() {
  const raw = useSyncExternalStore(subscribeNone, () => sessionStorage.getItem("psycourse-last-result"), () => null);
  if (!raw) return { score: 0, id: "" };
  try { const data = JSON.parse(raw); return { score: Number(data.score) || 0, id: String(data.id ?? "") }; } catch { return { score: 0, id: "" }; }
}

function ResultsContent() {
  const { id: routeId } = useParams<{ id: string }>();
  const { score, id: resultId } = useLastResult();
  const testId = resultId || routeId;
  useEffect(() => {
    const key = `psycourse-recorded-${testId}`;
    if (!testId || sessionStorage.getItem(key)) return;
    void fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, score, totalSoal: sampleQuestions.length }) }).then((response) => { if (response.ok) sessionStorage.setItem(key, "1"); });
  }, [score, testId]);
  return <div className="app-shell"><header className="app-topbar"><div className="container app-topbar-inner"><Link href="/dashboard"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link><Link href="/history" className="text-link">Riwayat tes</Link></div></header><main className="app-main"><div className="container" style={{maxWidth:760}}><section className="panel-card center" style={{padding:35}}><span className="eyebrow">HASIL LATIHAN</span><div className="result-score"><div><strong>{score}/{sampleQuestions.length}</strong><span>JAWABAN BENAR</span></div></div><h1 style={{fontSize:32}}>Bagus sudah menyelesaikan tes!</h1><p style={{color:"var(--muted)",maxWidth:500,margin:"12px auto 24px"}}>Hasil ini sudah disimpan ke riwayat tes akunmu.</p><div className="hero-actions" style={{justifyContent:"center"}}><Button href={`/courses/${testId.split("-")[0]||"logika"}`} variant="outline">Ulangi / pilih tes</Button><Button href="/dashboard">Kembali ke dashboard →</Button></div></section></div></main></div>;
}

export default function ResultsPage() {
  return <Suspense fallback={<div className="app-shell" />}><ResultsContent /></Suspense>;
}
