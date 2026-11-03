"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Button, PageIntro } from "@/components/UI";
import { AdminTestsManager } from "@/components/AdminTestsManager";
import { AdminCoursesManager } from "@/components/AdminCoursesManager";
import { AdminPoliciesManager } from "@/components/AdminPoliciesManager";

type QuestionRecord = {
  id: string;
  urutan: number;
  teks: string;
  kategori: string;
  tes: string;
  status: string;
};

type QuestionEdit = {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  status: string;
  hasAnswers: boolean;
};

const config: Record<string, { title: string; desc: string; columns: string[]; rows: string[][] }> = {
  courses: {
    title: "Kelola kategori",
    desc: "Kelola lima kategori tes IQ.",
    columns: ["Kategori", "Slug", "Status"],
    rows: [
      ["Logika & Pola", "logika", "Aktif"],
      ["Penalaran Numerik", "numerik", "Aktif"],
      ["Penalaran Verbal", "verbal", "Aktif"],
      ["Visual & Spasial", "spasial", "Aktif"],
      ["Memori & Konsentrasi", "memori", "Aktif"],
    ],
  },
  tests: {
    title: "Kelola versi tes",
    desc: "Kelola Test 1 tanpa timer, Test 2 bertimer, dan bank soal.",
    columns: ["Versi", "Timer", "Soal"],
    rows: [
      ["Test 1", "Tidak ada", "10"],
      ["Test 2", "10 menit (demo)", "10"],
      ["Practice Question Bank", "Tidak ada", "Per kategori"],
    ],
  },
  questions: {
    title: "Kelola pertanyaan",
    desc: "Lihat soal yang tersimpan di database atau impor bank soal untuk menambah konten.",
    columns: ["Urutan", "Pertanyaan", "Kategori / tes", "Status"],
    rows: [],
  },
  access: {
    title: "Kontrol akses",
    desc: "Tinjau peran dan izin akses. Data pengguna disamarkan dalam demo.",
    columns: ["Peran", "Izin", "Status"],
    rows: [
      ["Student", "Tes dan profil sendiri", "Aktif"],
      ["Admin", "Kelola konten dan akses", "Contoh"],
    ],
  },
  policies: {
    title: "Kelola kebijakan",
    desc: "Kelola tautan dan versi dokumen legal.",
    columns: ["Dokumen", "Versi", "Status"],
    rows: [
      ["Kebijakan Privasi", "Draft 1", "Perlu tinjauan"],
      ["Ketentuan Layanan", "Draft 1", "Perlu tinjauan"],
    ],
  },
};

function AdminSectionContent({ section }: { section: string }) {
  const key = section;
  const data = config[key] || config.courses;
  const [rows, setRows] = useState(data.rows);
  const [notice, setNotice] = useState("");
  const [editingAccessRow, setEditingAccessRow] = useState<number | null>(null);
  const [accessDraft, setAccessDraft] = useState<string[]>([]);
  const [addingAccessRow, setAddingAccessRow] = useState(false);
  const [targets, setTargets] = useState<{ id: string; label: string }[]>([]);
  const [questionRecords, setQuestionRecords] = useState<QuestionRecord[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<QuestionEdit | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState("");
  const [questionFormError, setQuestionFormError] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(key === "questions");
  const [questionLoadError, setQuestionLoadError] = useState("");

  function saveAccessRow(rowIndex: number) {
    if (accessDraft.length < 3 || accessDraft.some((value) => !value.trim())) {
      setNotice("Peran, izin, dan status harus diisi.");
      return;
    }
    setRows((current) => current.map((row, index) => index === rowIndex
      ? accessDraft.map((value) => value.trim())
      : row));
    setEditingAccessRow(null);
    setNotice("Data kontrol akses diperbarui pada tampilan ini.");
  }

  function addAccessRow() {
    if (accessDraft.length < 3 || accessDraft.some((value) => !value.trim())) {
      setNotice("Peran, izin, dan status harus diisi.");
      return;
    }
    setRows((current) => [...current, accessDraft.map((value) => value.trim())]);
    setAccessDraft([]);
    setAddingAccessRow(false);
    setNotice("Data akses ditambahkan pada tampilan ini.");
  }

  useEffect(() => {
    if (key !== "questions") return;
    let active = true;

    async function loadQuestions() {
      setQuestionLoadError("");
      try {
        const response = await fetch("/api/admin/questions", { cache: "no-store" });
        const result: {
          questions?: QuestionRecord[];
          targets?: { id: string; label: string }[];
          error?: { message?: string };
        } = await response.json();
        if (!response.ok) {
          throw new Error(result.error?.message || "Gagal memuat bank soal.");
        }
        if (!active) return;
        setQuestionRecords(result.questions ?? []);
        setRows((result.questions ?? []).map((question) => [
          String(question.urutan),
          question.teks,
          `${question.kategori} — ${question.tes}`,
          question.status,
        ]));
        setTargets(result.targets ?? []);
      } catch (error) {
        if (active) {
          setQuestionLoadError(error instanceof Error ? error.message : "Gagal memuat bank soal.");
        }
      } finally {
        if (active) setLoadingQuestions(false);
      }
    }

    void loadQuestions();
    return () => {
      active = false;
    };
  }, [key]);

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuestionFormError("");
    setSavingQuestion(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const choices = String(formData.get("choices") ?? "").split("|").map((choice) => choice.trim());

    try {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: formData.get("testId"),
          question: formData.get("question"),
          choices,
          answer: Number(formData.get("answer")),
          explanation: formData.get("explanation"),
          status: formData.get("status"),
        }),
      });
      const result: { error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menambahkan soal.");

      const refreshed = await fetch("/api/admin/questions", { cache: "no-store" });
      const refreshedData: {
        questions?: QuestionRecord[];
        targets?: { id: string; label: string }[];
        error?: { message?: string };
      } = await refreshed.json();
      if (!refreshed.ok) {
        throw new Error(refreshedData.error?.message || "Soal tersimpan, tetapi daftar gagal diperbarui.");
      }
      setQuestionRecords(refreshedData.questions ?? []);
      setRows((refreshedData.questions ?? []).map((question) => [
        String(question.urutan),
        question.teks,
        `${question.kategori} — ${question.tes}`,
        question.status,
      ]));
      setTargets(refreshedData.targets ?? []);
      setFormOpen(false);
      setNotice("Soal berhasil ditambahkan. Data yang sudah ada tetap tersimpan.");
      form.reset();
    } catch (error) {
      setQuestionFormError(error instanceof Error ? error.message : "Gagal menambahkan soal.");
    } finally {
      setSavingQuestion(false);
    }
  }

  async function editQuestion(questionId: string) {
    setQuestionFormError("");
    try {
      const response = await fetch(`/api/admin/questions/${encodeURIComponent(questionId)}`, { cache: "no-store" });
      const result: QuestionEdit & { error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal memuat detail soal.");
      setEditingQuestion(result);
      setFormOpen(false);
    } catch (error) {
      setQuestionFormError(error instanceof Error ? error.message : "Gagal memuat detail soal.");
    }
  }

  async function updateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingQuestion) return;
    setSavingQuestion(true);
    setQuestionFormError("");
    const formData = new FormData(event.currentTarget);
    const choices = String(formData.get("choices") ?? "").split("|").map((choice) => choice.trim());
    try {
      const response = await fetch(`/api/admin/questions/${encodeURIComponent(editingQuestion.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: formData.get("question"),
          choices,
          answer: Number(formData.get("answer")),
          explanation: formData.get("explanation"),
          status: formData.get("status"),
        }),
      });
      const result: { error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal mengedit soal.");

      const refreshed = await fetch("/api/admin/questions", { cache: "no-store" });
      const refreshedData: { questions?: QuestionRecord[]; error?: { message?: string } } = await refreshed.json();
      if (!refreshed.ok) throw new Error(refreshedData.error?.message || "Soal tersimpan, tetapi daftar gagal diperbarui.");
      setQuestionRecords(refreshedData.questions ?? []);
      setRows((refreshedData.questions ?? []).map((question) => [
        String(question.urutan),
        question.teks,
        `${question.kategori} — ${question.tes}`,
        question.status,
      ]));
      setEditingQuestion(null);
      setNotice("Soal berhasil diperbarui.");
    } catch (error) {
      setQuestionFormError(error instanceof Error ? error.message : "Gagal mengedit soal.");
    } finally {
      setSavingQuestion(false);
    }
  }

  async function deleteQuestion(question: QuestionRecord) {
    if (!window.confirm(`Hapus soal "${question.teks}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingQuestionId(question.id);
    setQuestionFormError("");
    try {
      const response = await fetch(`/api/admin/questions/${encodeURIComponent(question.id)}`, { method: "DELETE" });
      const result: { error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menghapus soal.");
      const remainingQuestions = questionRecords.filter((item) => item.id !== question.id);
      setQuestionRecords(remainingQuestions);
      setRows(remainingQuestions.map((item) => [
        String(item.urutan),
        item.teks,
        `${item.kategori} — ${item.tes}`,
        item.status,
      ]));
      setNotice("Soal berhasil dihapus.");
      if (editingQuestion?.id === question.id) setEditingQuestion(null);
    } catch (error) {
      setQuestionFormError(error instanceof Error ? error.message : "Gagal menghapus soal.");
    } finally {
      setDeletingQuestionId("");
    }
  }

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
        <PageIntro eyebrow="ADMIN MANAGEMENT" title={data.title} description={data.desc} />
        {key !== "questions" && (
          <div className="notice warning">Mode demo: perubahan hanya berada di state halaman dan tidak tersimpan di database.</div>
        )}
        <div className="panel-card">
          <div className="panel-head">
            <h2 style={{ fontSize: 20 }}>{key === "questions" ? `Bank soal${loadingQuestions ? "" : ` (${rows.length})`}` : "Data saat ini"}</h2>
            <div className="hero-actions" style={key === "questions" ? { flexWrap: "wrap" } : undefined}>
              {key === "questions" && (
                <>
                  <Button href="/admin/questions/import" variant="outline">Impor bank soal</Button>
                  <Button onClick={() => { setFormOpen((open) => !open); setQuestionFormError(""); }}>
                    {formOpen ? "Tutup form" : "+ Tambah data"}
                  </Button>
                </>
              )}
              {key !== "questions" && (
                <Button onClick={() => {
                  if (key === "access") {
                    setAccessDraft(["", "", ""]);
                    setAddingAccessRow((open) => !open);
                    setNotice("");
                  } else {
                    setNotice("Form tambah data demo tersedia. Hubungkan ke endpoint admin untuk menyimpan data.");
                  }
                }}>
                  + Tambah data
                </Button>
              )}
            </div>
          </div>
          {key === "access" && addingAccessRow && (
            <div className="panel-card form-stack">
              <h3>Tambah data akses</h3>
              <label className="field">
                <span>Peran</span>
                <input value={accessDraft[0] ?? ""} onChange={(event) => setAccessDraft((draft) => [event.target.value, draft[1] ?? "", draft[2] ?? ""])} required />
              </label>
              <label className="field">
                <span>Izin</span>
                <input value={accessDraft[1] ?? ""} onChange={(event) => setAccessDraft((draft) => [draft[0] ?? "", event.target.value, draft[2] ?? ""])} required />
              </label>
              <label className="field">
                <span>Status</span>
                <input value={accessDraft[2] ?? ""} onChange={(event) => setAccessDraft((draft) => [draft[0] ?? "", draft[1] ?? "", event.target.value])} required />
              </label>
              <div className="hero-actions">
                <Button onClick={addAccessRow}>Simpan</Button>
                <Button variant="outline" onClick={() => { setAddingAccessRow(false); setAccessDraft([]); }}>Batal</Button>
              </div>
            </div>
          )}
          {key === "questions" && loadingQuestions && <p role="status">Memuat bank soal dari database...</p>}
          {key === "questions" && questionLoadError && (
            <div className="notice warning" role="alert">
              {questionLoadError}{" "}
              {questionLoadError.includes("Silakan masuk") && <Link className="text-link" href="/admin">Masuk sebagai admin</Link>}
            </div>
          )}
          {key === "questions" && formOpen && (
            <form className="panel-card form-stack" onSubmit={addQuestion}>
              <h3>Tambah soal ke bank</h3>
              <label className="field">
                <span>Kategori dan versi tes</span>
                <select name="testId" required disabled={savingQuestion || targets.length === 0}>
                  {targets.length === 0 && <option value="">Tidak ada tes aktif</option>}
                  {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Pertanyaan</span>
                <textarea name="question" rows={3} maxLength={5000} required disabled={savingQuestion} />
              </label>
              <label className="field">
                <span>Pilihan jawaban (pisahkan dengan |)</span>
                <textarea name="choices" rows={2} placeholder="Pilihan A | Pilihan B | Pilihan C" required disabled={savingQuestion} />
              </label>
              <label className="field">
                <span>Nomor jawaban benar (mulai dari 1)</span>
                <input name="answer" type="number" min={1} max={10} required disabled={savingQuestion} />
              </label>
              <label className="field">
                <span>Pembahasan</span>
                <textarea name="explanation" rows={3} maxLength={10000} disabled={savingQuestion} />
              </label>
              <label className="field">
                <span>Status soal</span>
                <select name="status" defaultValue="DRAFT" disabled={savingQuestion}>
                  <option value="DRAFT">Draft (perlu ditinjau)</option>
                  <option value="AKTIF">Aktif</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </select>
              </label>
              {targets.length === 0 && <div className="notice warning">Tidak ada kategori dan tes aktif untuk menerima soal.</div>}
              {questionFormError && <div className="notice warning" role="alert">{questionFormError}</div>}
              <Button type="submit" disabled={savingQuestion || targets.length === 0}>
                {savingQuestion ? "Menyimpan..." : "Simpan soal"}
              </Button>
            </form>
          )}
          {key === "questions" && editingQuestion && (
            <form className="panel-card form-stack" onSubmit={updateQuestion}>
              <h3>Edit soal</h3>
              {editingQuestion.hasAnswers && (
                <div className="notice warning">
                  Soal ini sudah pernah dikerjakan dan tidak dapat diedit agar riwayat tes tetap konsisten.
                </div>
              )}
              <label className="field">
                <span>Pertanyaan</span>
                <textarea name="question" rows={3} maxLength={5000} defaultValue={editingQuestion.question} required disabled={savingQuestion || editingQuestion.hasAnswers} />
              </label>
              <label className="field">
                <span>Pilihan jawaban (pisahkan dengan |)</span>
                <textarea name="choices" rows={2} defaultValue={editingQuestion.choices.join(" | ")} required disabled={savingQuestion || editingQuestion.hasAnswers} />
              </label>
              <label className="field">
                <span>Nomor jawaban benar (mulai dari 1)</span>
                <input name="answer" type="number" min={1} max={10} defaultValue={editingQuestion.answer} required disabled={savingQuestion || editingQuestion.hasAnswers} />
              </label>
              <label className="field">
                <span>Pembahasan</span>
                <textarea name="explanation" rows={3} maxLength={10000} defaultValue={editingQuestion.explanation} disabled={savingQuestion || editingQuestion.hasAnswers} />
              </label>
              <label className="field">
                <span>Status soal</span>
                <select name="status" defaultValue={editingQuestion.status} disabled={savingQuestion || editingQuestion.hasAnswers}>
                  <option value="DRAFT">Draft</option>
                  <option value="AKTIF">Aktif</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </select>
              </label>
              {questionFormError && <div className="notice warning" role="alert">{questionFormError}</div>}
              <div className="hero-actions">
                <Button type="submit" disabled={savingQuestion || editingQuestion.hasAnswers}>
                  {savingQuestion ? "Menyimpan..." : "Simpan perubahan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setEditingQuestion(null); setQuestionFormError(""); }} disabled={savingQuestion}>
                  Batal
                </Button>
              </div>
            </form>
          )}
          {key === "questions" && notice && <div className="notice" role="status">{notice}</div>}
          {key === "questions" && questionFormError && !formOpen && !editingQuestion && (
            <div className="notice warning" role="alert">{questionFormError}</div>
          )}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>{data.columns.map((column) => <th key={column}>{column}</th>)}<th>Aksi</th></tr>
              </thead>
              <tbody>
                {key === "questions" && !loadingQuestions && !questionLoadError && questionRecords.map((question) => (
                  <tr key={question.id}>
                    <td>{question.urutan}</td>
                    <td>{question.teks}</td>
                    <td>{question.kategori} — {question.tes}</td>
                    <td>{question.status}</td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                        <button
                          className="text-link"
                          type="button"
                          onClick={() => void editQuestion(question.id)}
                          disabled={deletingQuestionId === question.id || savingQuestion}
                        >
                          Edit
                        </button>
                        <button
                          className="text-link"
                          type="button"
                          onClick={() => void deleteQuestion(question)}
                          disabled={deletingQuestionId === question.id}
                        >
                          {deletingQuestionId === question.id ? "Menghapus..." : "Hapus"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {key !== "questions" && !loadingQuestions && !questionLoadError && rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {key === "access" && editingAccessRow === rowIndex ? (
                      <>
                        <td><input aria-label="Peran" value={accessDraft[0] ?? ""} onChange={(event) => setAccessDraft((draft) => [event.target.value, draft[1] ?? "", draft[2] ?? ""])} required /></td>
                        <td><input aria-label="Izin" value={accessDraft[1] ?? ""} onChange={(event) => setAccessDraft((draft) => [draft[0] ?? "", event.target.value, draft[2] ?? ""])} required /></td>
                        <td><input aria-label="Status" value={accessDraft[2] ?? ""} onChange={(event) => setAccessDraft((draft) => [draft[0] ?? "", draft[1] ?? "", event.target.value])} required /></td>
                        <td>
                          <button className="text-link" type="button" onClick={() => saveAccessRow(rowIndex)}>Simpan</button>
                          {"　"}
                          <button className="text-link" type="button" onClick={() => setEditingAccessRow(null)}>Batal</button>
                        </td>
                      </>
                    ) : (
                      <>
                        {row.map((value, cellIndex) => <td key={cellIndex}>{value}</td>)}
                        <td>
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              if (key === "access") {
                                setAccessDraft([...row]);
                                setEditingAccessRow(rowIndex);
                              }
                              else setNotice(`Mode edit untuk baris ${rowIndex + 1} belum dihubungkan ke API.`);
                            }}
                          >
                            Edit
                          </button>
                          {"　"}
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              if (key === "access" && !window.confirm(`Hapus akses "${row[0]}" dari tampilan demo?`)) return;
                              setRows((current) => current.filter((_, index) => index !== rowIndex));
                              setNotice(key === "access" ? "Data akses dihapus dari tampilan ini." : "Baris dihapus dari tampilan demo saja.");
                              if (editingAccessRow === rowIndex) setEditingAccessRow(null);
                            }}
                          >
                            Hapus
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {key === "questions" && !loadingQuestions && !questionLoadError && rows.length === 0 && (
                  <tr><td colSpan={data.columns.length + 1}>Belum ada soal di database. Impor CSV untuk menambahkan bank soal.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {notice && <div className="notice" style={{ marginTop: 16, marginBottom: 0 }}>{notice}</div>}
        </div>
      </main>
    </div>
  );
}

function AdminSectionInner() {
  const params = useParams();
  const key = String(params.section);
  if (key === "courses") return <AdminCoursesManager />;
  if (key === "tests") return <AdminTestsManager />;
  if (key === "policies") return <AdminPoliciesManager />;
  return <AdminSectionContent key={key} section={key} />;
}

export default function AdminSection() {
  return <Suspense fallback={<div className="admin-shell" />}><AdminSectionInner /></Suspense>;
}
