"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, PageIntro } from "@/components/UI";

type ImportTarget = { id: string; label: string };
type ErrorResponse = { error?: { message?: string } };
type ImportResponse = { imported?: number; targets?: ImportTarget[] } & ErrorResponse;

const csvTemplate = [
  "question,choices,answer,explanation,status",
  '"Pola angka 2, 4, 8, ...","10 | 12 | 16 | 32",4,"Setiap angka dikali dua.",Draft',
].join("\r\n");

export function AdminQuestionImport() {
  const [targets, setTargets] = useState<ImportTarget[]>([]);
  const [testId, setTestId] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/questions/import", { cache: "no-store" })
      .then(async (response) => {
        const body: ImportResponse = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Gagal memuat daftar tes.");
        if (!active) return;
        const availableTargets = body.targets ?? [];
        setTargets(availableTargets);
        setTestId(availableTargets[0]?.id ?? "");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Gagal memuat daftar tes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function downloadTemplate() {
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-bank-soal.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(formData: FormData) {
    setError("");
    setFeedback("");
    setImporting(true);
    try {
      const response = await fetch("/api/admin/questions/import", {
        method: "POST",
        body: formData,
      });
      const result: ImportResponse = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal mengimpor soal.");
      setFeedback(`${result.imported ?? 0} soal berhasil diimpor. Soal berstatus Draft perlu ditinjau sebelum dipakai.`);
      if (fileInput.current) fileInput.current.value = "";
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Gagal mengimpor soal.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="container admin-header-inner">
          <Link href="/admin/dashboard" className="admin-brand">
            Psy<span>Course</span> <small style={{ fontSize: 11, color: "#748092" }}>ADMIN</small>
          </Link>
          <Link className="text-link" href="/admin/questions">← Kelola pertanyaan</Link>
        </div>
      </header>
      <main className="container app-main" style={{ maxWidth: 900 }}>
        <PageIntro
          eyebrow="ADMIN MANAGEMENT"
          title="Impor bank soal"
          description="Unggah CSV untuk menambahkan soal ke kategori dan versi tes yang dipilih."
        />
        <section className="panel-card">
          <div className="panel-head">
            <h2 style={{ fontSize: 20 }}>Format file CSV</h2>
            <Button variant="outline" onClick={downloadTemplate}>Unduh template CSV</Button>
          </div>
          <p>
            Maksimal 500 soal dan ukuran file 1 MB. Kolom wajib: <code>question</code>, <code>choices</code>,{" "}
            <code>answer</code>, dan <code>explanation</code>. Kolom <code>status</code> opsional.
          </p>
          <p>
            Pilihan jawaban dipisahkan dengan tanda <code>|</code>. Isi <code>answer</code> dengan nomor pilihan
            mulai dari 1. Status kosong akan menjadi Draft; status Draft, Aktif/Ready, dan Nonaktif didukung.
            Soal Draft tidak tersedia untuk peserta sampai diaktifkan.
          </p>
        </section>

        <form
          id="question-import-form"
          className="panel-card form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            formData.set("testId", testId);
            void importFile(formData);
          }}
        >
          <label className="field">
            <span>Kategori dan versi tes tujuan</span>
            <select
              name="testId"
              value={testId}
              onChange={(event) => setTestId(event.target.value)}
              disabled={loading || importing || targets.length === 0}
              required
            >
              {targets.length === 0 && <option value="">Tidak ada tes aktif</option>}
              {targets.map((target) => (
                <option key={target.id} value={target.id}>{target.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>File CSV</span>
            <input
              ref={fileInput}
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={loading || importing || targets.length === 0}
            />
          </label>
          {loading && <p role="status">Memuat daftar tes...</p>}
          {!loading && targets.length === 0 && !error && (
            <div className="notice warning" role="status">Tidak ada kategori dan tes aktif untuk menerima impor.</div>
          )}
          {error && <div className="notice warning" role="alert">{error}</div>}
          {feedback && <div className="notice" role="status">{feedback}</div>}
          <div className="hero-actions">
            <Button type="submit" disabled={loading || importing || targets.length === 0}>
              {importing ? "Mengimpor..." : "Impor soal"}
            </Button>
            <Button href="/admin/questions" variant="outline">Kembali ke bank soal</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
