"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, PageIntro } from "@/components/UI";

type Course = {
  id: string;
  slug: string;
  judul: string;
  subjudul: string;
  ikon: string;
  warna: string;
  deskripsi: string;
  urutan: number;
  status: "DRAFT" | "AKTIF" | "NONAKTIF";
  statusLabel: string;
};

type CourseResponse = { courses?: Course[]; error?: { message?: string } };

const initialCourse: Course = {
  id: "",
  slug: "",
  judul: "",
  subjudul: "",
  ikon: "",
  warna: "#2F855A",
  deskripsi: "",
  urutan: 0,
  status: "DRAFT",
  statusLabel: "Draft",
};

const iconOptions = [
  { value: "◈", label: "Pola" },
  { value: "＋", label: "Numerik" },
  { value: "Aa", label: "Verbal" },
  { value: "⬡", label: "Spasial" },
  { value: "◎", label: "Memori" },
  { value: "✦", label: "Bintang" },
];

export function AdminCoursesManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [editing, setEditing] = useState<Course | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [colorValue, setColorValue] = useState(initialCourse.warna);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/courses", { cache: "no-store" })
      .then(async (response) => {
        const result: CourseResponse = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Gagal memuat course.");
        if (active) setCourses(result.courses ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Gagal memuat course.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const isEditing = editing !== null;
    setError("");
    setFeedback("");
    setSaving(true);

    try {
      const response = await fetch(
        isEditing ? `/api/admin/courses/${encodeURIComponent(editing.id)}` : "/api/admin/courses",
        {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judul: formData.get("judul"),
          slug: formData.get("slug"),
          subjudul: formData.get("subjudul"),
          ikon: formData.get("ikon"),
          warna: formData.get("warna"),
          deskripsi: formData.get("deskripsi"),
          urutan: Number(formData.get("urutan")),
          status: formData.get("status"),
        }),
      });
      const result: { error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menyimpan course.");

      const refreshed = await fetch("/api/admin/courses", { cache: "no-store" });
      const refreshedResult: CourseResponse = await refreshed.json();
      if (!refreshed.ok) throw new Error(refreshedResult.error?.message || "Course tersimpan, tetapi daftar gagal diperbarui.");
      setCourses(refreshedResult.courses ?? []);
      setEditing(null);
      setFormOpen(false);
      setFeedback(isEditing ? "Perubahan course berhasil disimpan." : "Course berhasil ditambahkan sebagai Draft.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan perubahan course.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(
      `Hapus course "${course.judul}"?\n\nSemua versi tes dan soal yang terhubung juga akan dihapus. Course dengan riwayat tes atau akses pembelian tidak dapat dihapus.`,
    )) return;

    setError("");
    setFeedback("");
    setDeletingId(course.id);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(course.id)}`, { method: "DELETE" });
      const result: { error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menghapus course.");

      setCourses((current) => current.filter((item) => item.id !== course.id));
      if (editing?.id === course.id) setEditing(null);
      setFeedback(`Course "${course.judul}" berhasil dihapus.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus course.");
    } finally {
      setDeletingId("");
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
        <PageIntro
          eyebrow="ADMIN MANAGEMENT"
          title="Kelola courses"
          description="Tambah, lihat, dan edit course yang tersimpan di database."
        />
        {error && <div className="notice warning" role="alert">{error}</div>}
        {feedback && <div className="notice" role="status">{feedback}</div>}

        {(editing || formOpen) && (
          <form className="panel-card form-stack" onSubmit={saveCourse} key={editing?.id ?? "new-course"}>
            <h2 style={{ fontSize: 20 }}>{editing ? `Edit course: ${editing.judul}` : "Tambah course"}</h2>
            <label className="field">
              <span>Nama course</span>
              <input name="judul" defaultValue={editing?.judul} maxLength={100} required disabled={saving} />
            </label>
            <label className="field">
              <span>Slug (untuk URL)</span>
              <input name="slug" defaultValue={editing?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} required disabled={saving} />
            </label>
            <label className="field">
              <span>Subjudul</span>
              <input name="subjudul" defaultValue={editing?.subjudul} maxLength={200} disabled={saving} />
            </label>
            <label className="field">
              <span>Ikon</span>
              <select name="ikon" defaultValue={editing?.ikon ?? iconOptions[0].value} required disabled={saving}>
                {editing && !iconOptions.some((option) => option.value === editing.ikon) && (
                  <option value={editing.ikon}>Ikon saat ini ({editing.ikon})</option>
                )}
                {iconOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.value} — {option.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Warna (HEX)</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  name="warna"
                  type="color"
                  value={colorValue}
                  onChange={(event) => setColorValue(event.target.value)}
                  required
                  disabled={saving}
                  aria-label="Pilih warna course"
                  style={{ width: 72, height: 48, padding: 4, flex: "0 0 72px" }}
                />
                <span style={{ color: "var(--muted)", fontSize: 14 }}>
                  {(editing ? colorValue : initialCourse.warna).toUpperCase()}
                </span>
              </div>
            </label>
            <label className="field">
              <span>Deskripsi</span>
              <textarea name="deskripsi" rows={4} defaultValue={editing?.deskripsi} maxLength={5000} disabled={saving} />
            </label>
            <label className="field">
              <span>Urutan tampil</span>
              <input name="urutan" type="number" min={0} max={10000} defaultValue={editing?.urutan ?? courses.length} required disabled={saving} />
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
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah course"}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditing(null); setFormOpen(false); setError(""); }}
                disabled={saving}
              >
                Batal
              </Button>
            </div>
          </form>
        )}

        <section className="panel-card">
          <div className="panel-head">
            <h2 style={{ fontSize: 20 }}>Course</h2>
            <Button
              onClick={() => {
                setError("");
                setFeedback("");
                setEditing(null);
                setColorValue(initialCourse.warna);
                setFormOpen((open) => !open);
              }}
            >
              {formOpen && !editing ? "Tutup form" : "+ Tambah data"}
            </Button>
          </div>
          {loading ? (
            <p role="status">Memuat course dari database...</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Nama</th><th>Slug</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <td>{course.judul}</td>
                      <td>{course.slug}</td>
                      <td>{course.statusLabel}</td>
                      <td>
                        <div style={{ display: "flex", gap: 12 }}>
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              setError("");
                              setFeedback("");
                              setColorValue(/^#[0-9a-fA-F]{6}$/.test(course.warna) ? course.warna : initialCourse.warna);
                              setFormOpen(false);
                              setEditing(course);
                            }}
                            disabled={deletingId === course.id}
                          >
                            Edit
                          </button>
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => void deleteCourse(course)}
                            disabled={deletingId === course.id}
                          >
                            {deletingId === course.id ? "Menghapus..." : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {courses.length === 0 && <tr><td colSpan={4}>Belum ada course di database.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
