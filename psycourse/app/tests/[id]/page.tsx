"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Clock, ChevronLeft, ChevronRight, Flag, LoaderCircle } from "lucide-react";
import { Button } from "@/components/UI";

type PublicQuestion = {
  id: string;
  urutan: number;
  teks: string;
  pilihan: string[];
};

type AttemptPayload = {
  attempt: {
    id: string;
    status: "BERLANGSUNG" | "SELESAI" | "KEDALUWARSA";
    mulaiPada: string;
    deadlineAt: string | null;
    selesaiPada?: string | null;
    totalSoal: number;
    skor?: number | null;
  };
  test: {
    id: string;
    slug: string;
    tipe: "TEST_1" | "TEST_2" | "PRACTICE";
    timerDetik: number | null;
    category: { slug: string; judul: string };
  };
  questions: PublicQuestion[];
  answers?: Array<{ questionId: string; pilihan: number }>;
  serverNow: string;
};

function TestInner() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const isTimed = id.includes("test-2");
  const isPractice = id.includes("practice");

  const [attempt, setAttempt] = useState<AttemptPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [seconds, setSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitStarted = useRef(false);
  const serverOffset = useRef(0);

  const loadAttempt = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const testResponse = await fetch(`/api/tests/${encodeURIComponent(id)}`, { cache: "no-store" });
      const testData = await testResponse.json();
      if (!testResponse.ok) {
        throw new Error(testData?.error?.message || testData?.message || "Detail tes tidak dapat dimuat.");
      }

      const storageKey = `psycourse-attempt-${id}`;
      const savedAttemptId = sessionStorage.getItem(storageKey);
      let payload: AttemptPayload | null = null;

      if (savedAttemptId) {
        const existingResponse = await fetch(`/api/attempts/${encodeURIComponent(savedAttemptId)}`, {
          cache: "no-store",
        });
        if (existingResponse.ok) {
          payload = await existingResponse.json();
        } else {
          sessionStorage.removeItem(storageKey);
        }
      }

      if (!payload) {
        const response = await fetch(`/api/tests/${encodeURIComponent(id)}/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.message || "Tes belum dapat dimulai. Coba lagi.");
        }
        payload = data;
        sessionStorage.setItem(storageKey, payload.attempt.id);
      }

      if (payload.attempt.status !== "BERLANGSUNG") {
        router.replace(`/results/${payload.attempt.id}`);
        return;
      }

      serverOffset.current = new Date(payload.serverNow).getTime() - Date.now();
      setAttempt(payload);
      setAnswers(Object.fromEntries((payload.answers ?? []).map((answer) => [answer.questionId, answer.pilihan])));
      if (payload.attempt.deadlineAt) {
        setSeconds(Math.max(0, Math.ceil(
          (new Date(payload.attempt.deadlineAt).getTime() - (Date.now() + serverOffset.current)) / 1000
        )));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat tes.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  const submit = useCallback(async () => {
    if (!attempt || submitStarted.current) return;
    submitStarted.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/attempts/${encodeURIComponent(attempt.attempt.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || "Jawaban belum berhasil dikirim.");
      }
      router.replace(`/results/${attempt.attempt.id}`);
    } catch (err) {
      submitStarted.current = false;
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban. Coba lagi.");
    }
  }, [attempt, router]);

  useEffect(() => {
    if (!attempt?.attempt.deadlineAt || submitting) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil(
        (new Date(attempt.attempt.deadlineAt as string).getTime() - (Date.now() + serverOffset.current)) / 1000
      ));
      setSeconds(remaining);
      if (remaining <= 0) void submit();
    }, 500);
    return () => window.clearInterval(timer);
  }, [attempt, submit, submitting]);

  const chooseAnswer = async (question: PublicQuestion, pilihan: number) => {
    if (!attempt || saving || submitting) return;
    const previousChoice = answers[question.id];
    setAnswers((current) => ({ ...current, [question.id]: pilihan }));
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/attempts/${encodeURIComponent(attempt.attempt.id)}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, pilihan }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          router.replace(`/results/${attempt.attempt.id}`);
          return;
        }
        throw new Error(data?.error?.message || data?.message || "Jawaban belum berhasil disimpan.");
      }
    } catch (err) {
      setAnswers((current) => {
        const next = { ...current };
        if (previousChoice === undefined) delete next[question.id];
        else next[question.id] = previousChoice;
        return next;
      });
      setError(err instanceof Error ? err.message : "Gagal menyimpan jawaban.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="app-shell"><main className="app-main"><div className="container question-shell" style={{ padding: 48, textAlign: "center" }}><LoaderCircle className="animate-spin" style={{ margin: "0 auto 12px" }}/><p>Menyiapkan tesmu...</p></div></main></div>;
  }

  if (error && !attempt) {
    return <div className="app-shell"><main className="app-main"><div className="container question-shell" style={{ padding: 32 }}><h2>Tes belum bisa dibuka</h2><p style={{ color: "var(--muted)" }}>{error}</p><Button onClick={() => void loadAttempt()}>Coba lagi</Button></div></main></div>;
  }

  if (!attempt) return null;

  const question = attempt.questions[index];
  if (!question) return <div className="app-shell"><main className="app-main"><div className="container question-shell"><p>Soal belum tersedia.</p></div></main></div>;

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = index === attempt.questions.length - 1;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <Link href="/dashboard"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link>
          <Link className="text-link" href="/dashboard">Keluar dari tes</Link>
        </div>
      </header>
      <main className="app-main">
        <div className="container question-shell">
          <div className="question-top">
            <div>
              <Link
                href={`/courses/${attempt.test.category.slug}`}
                className="text-link"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 14, fontWeight: 600 }}
              >
                <ChevronLeft size={18}/> Kembali ke kategori
              </Link>
              <span className="eyebrow">
                {isPractice ? "PRACTICE QUESTION BANK" : isTimed ? "TEST 2 · BERTIMER" : "TEST 1 · TANPA TIMER"}
              </span>
              <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13 }}>
                {attempt.test.category.judul} · {isPractice ? "Latihan berulang" : "Latihan soal"}
              </p>
            </div>
            {attempt.attempt.deadlineAt && (
              <div className="timer"><Clock size={16}/>{Math.floor((seconds ?? 0) / 60).toString().padStart(2, "0")}:{((seconds ?? 0) % 60).toString().padStart(2, "0")}</div>
            )}
          </div>

          <div className="question-card">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
              <span>Soal {index + 1} dari {attempt.questions.length}</span>
              <span>{answeredCount} dijawab</span>
            </div>
            <div className="question-progress"><span style={{ width: `${((index + 1) / attempt.questions.length) * 100}%` }}/></div>
            <h2>{question.teks}</h2>

            {question.pilihan.map((choice, choiceIndex) => (
              <label key={`${question.id}-${choiceIndex}`} className={`answer-choice ${answers[question.id] === choiceIndex ? "selected" : ""}`}>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={answers[question.id] === choiceIndex}
                  disabled={saving || submitting}
                  onChange={() => void chooseAnswer(question, choiceIndex)}
                />
                <span style={{ fontWeight: 800, color: "var(--green-dark)" }}>{String.fromCharCode(65 + choiceIndex)}.</span>
                <span>{choice}</span>
              </label>
            ))}

            {error && <p role="alert" style={{ color: "#b42318", fontSize: 13, marginTop: 12 }}>{error}</p>}
            {saving && <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>Menyimpan jawaban...</p>}

            <div className="question-controls">
              <Button variant="outline" disabled={index === 0 || saving || submitting} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
                <ChevronLeft size={16}/> Sebelumnya
              </Button>
              {isLastQuestion ? (
                <Button disabled={saving || submitting} onClick={() => void submit()}>
                  {submitting ? "Mengirim..." : <><Flag size={15}/> {isPractice ? "Selesai latihan" : "Kirim jawaban"}</>}
                </Button>
              ) : (
                <Button disabled={saving || submitting} onClick={() => setIndex((current) => Math.min(attempt.questions.length - 1, current + 1))}>
                  Berikutnya <ChevronRight size={16}/>
                </Button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "20px 0 0" }}>
              Jawaban tersimpan otomatis. {isTimed ? "Tes akan dikirim otomatis saat waktu habis." : "Kamu bisa meninjau jawaban sebelum mengirim tes."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TestPage() {
  return <Suspense fallback={<div className="app-shell"/>}><TestInner/></Suspense>;
}
