"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, PageIntro } from "@/components/UI";

type TestType = "TEST_1" | "TEST_2" | "PRACTICE";
type TestStatus = "DRAFT" | "AKTIF" | "NONAKTIF";
type TestRecord = {
  id: string;
  slug: string;
  type: TestType;
  name: string;
  categoryId: string;
  category: string;
  timerSeconds: number | null;
  status: TestStatus;
  statusLabel: string;
  questionCount: number;
  attemptCount: number;
};
type CategoryOption = { id: string; name: string; availableTypes: TestType[] };
type ApiPayload = {
  tests?: TestRecord[];
  categories?: CategoryOption[];
  error?: { message?: string };
};

const typeLabels: Record<TestType, string> = {
  TEST_1: "Test 1",
  TEST_2: "Test 2",
  PRACTICE: "Practice Question Bank",
};

export function AdminTestsManager() {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TestRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadTests() {
    const response = await fetch("/api/admin/tests", { cache: "no-store" });
    const result: ApiPayload = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Gagal memuat versi tes.");
    setTests(result.tests ?? []);
    setCategories(result.categories ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/tests", { cache: "no-store" })
      .then(async (response) => {
        const result: ApiPayload = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Gagal memuat versi tes.");
        if (!active) return;
        setTests(result.tests ?? []);
        setCategories(result.categories ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Gagal memuat versi tes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError("");
    setFeedback("");
    setSaving(true);
    const timerText = String(formData.get("timerMinutes") ?? "").trim();
    const [categoryId, selectedType] = String(formData.get("version") ?? "").split(":");
    const createType = selectedType as TestType;
    const createBody = {
      type: createType,
      categoryId,
      status: formData.get("status"),
      timerSeconds: createType === "TEST_2" && timerText ? Number(timerText) * 60 : null,
    };
    const updateBody = {
      status: formData.get("status"),
      ...(editing?.type === "TEST_2"
        ? { timerSeconds: timerText ? Number(timerText) * 60 : null }
        : {}),
    };

    try {
      const response = await fetch(editing ? `/api/admin/tests/${encodeURIComponent(editing.id)}` : "/api/admin/tests", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? updateBody : createBody),
      });
      const result: ApiPayload = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menyimpan versi tes.");
      await loadTests();
      setEditing(null);
      setFormOpen(false);
      setFeedback(editing ? "Konfigurasi versi tes berhasil diperbarui." : "Versi tes berhasil ditambahkan.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan versi tes.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTest(test: TestRecord) {
    const details = test.questionCount > 0
      ? `Ini juga akan menghapus ${test.questionCount} soal yang terhubung.`
      : "Versi tes ini tidak memiliki soal.";
    if (!window.confirm(`Hapus ${test.name} untuk ${test.category}?\n\n${details} Data yang sudah punya riwayat pengerjaan tidak dapat dihapus.`)) {
      return;
    }

    setError("");
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/tests/${encodeURIComponent(test.id)}`, { method: "DELETE" });
      const result: ApiPayload = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menghapus versi tes.");
      await loadTests();
      setFeedback(`${test.name} untuk ${test.category} berhasil dihapus.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus versi tes.");
    }
  }

  const availableTypes = categories.flatMap((category) =>
    category.availableTypes.map((type) => ({ categoryId: category.id, category: category.name, type })),
  );

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="container admin-header-inner">
          <Link href="/admin/dashboard" className="admin-brand">
            Psy<span>Course</span> <small style={{ fontSize: 11, color: "#748092" }}>ADMIN</small>
          </Link>
          <Link className="text-link" href="/admin/dashboard">← Dashboard admin</Link>
        </div>
      </header>
      <main className="container app-main">
        <PageIntro
          eyebrow="ADMIN MANAGEMENT"
          title="Kelola versi tes"
          description="Kelola Test 1, Test 2, dan bank latihan yang tersimpan di database."
        />

        {error && <div className="notice warning" role="alert">{error}</div>}
        {feedback && <div className="notice" role="status">{feedback}</div>}

        {formOpen && (
          <form className="panel-card form-stack" onSubmit={saveTest}>
            <h2 style={{ fontSize: 20 }}>{editing ? "Ubah versi tes" : "Tambah versi tes"}</h2>
            {!editing && (
              <label className="field">
                <span>Course dan versi tes</span>
                <select name="version" required disabled={saving}>
                  {availableTypes.map((option) => (
                    <option key={`${option.categoryId}-${option.type}`} value={`${option.categoryId}:${option.type}`}>
                      {option.category} — {typeLabels[option.type]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {editing && (
              <p>{editing.category} — {editing.name}</p>
            )}
            <label className="field">
              <span>Durasi timer Test 2 (menit; kosongkan untuk tanpa timer)</span>
              <input
                name="timerMinutes"
                type="number"
                min={1}
                max={1440}
                defaultValue={editing?.timerSeconds ? String(editing.timerSeconds / 60) : ""}
                disabled={saving}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={editing?.status ?? "DRAFT"} disabled={saving}>
                <option value="DRAFT">Draft</option>
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </label>
            <div className="hero-actions">
              <Button type="submit" disabled={saving || (!editing && availableTypes.length === 0)}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setFormOpen(false); setEditing(null); setError(""); }}
                disabled={saving}
              >
                Batal
              </Button>
            </div>
          </form>
        )}

        <section className="panel-card">
          <div className="panel-head">
            <h2 style={{ fontSize: 20 }}>Versi tes</h2>
            <Button
              onClick={() => {
                setEditing(null);
                setError("");
                if (formOpen) {
                  setFormOpen(false);
                  setFeedback("");
                  return;
                }
                if (availableTypes.length === 0) {
                  setFeedback(
                    categories.length === 0
                      ? "Belum ada course aktif. Tambahkan atau aktifkan course di Kelola kategori; versi tes hanya dapat dibuat untuk course aktif."
                      : "Semua course aktif sudah memiliki Test 1, Test 2, dan Bank Latihan. Tambahkan course baru di Kelola kategori; ketiga versi tes dibuat otomatis.",
                  );
                  return;
                }
                setFormOpen(true);
                setFeedback("");
              }}
              disabled={loading || saving}
            >
              {formOpen && !editing ? "Tutup form" : "+ Tambah data"}
            </Button>
          </div>
          {loading ? (
            <p role="status">Memuat versi tes dari database...</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Course</th><th>Versi</th><th>Timer</th><th>Jumlah soal</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr key={test.id}>
                      <td>{test.category}</td>
                      <td>{test.name}</td>
                      <td>{test.timerSeconds ? `${test.timerSeconds / 60} menit` : "Tidak ada"}</td>
                      <td>{test.questionCount}</td>
                      <td>{test.statusLabel}</td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => {
                            setEditing(test);
                            setFormOpen(true);
                            setError("");
                            setFeedback("");
                          }}
                        >
                          Edit
                        </button>
                        {"　"}
                        <button
                          className="text-link"
                          onClick={() => void deleteTest(test)}
                          aria-label={`Hapus ${test.name} untuk ${test.category}`}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tests.length === 0 && <tr><td colSpan={6}>Belum ada versi tes di database.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
