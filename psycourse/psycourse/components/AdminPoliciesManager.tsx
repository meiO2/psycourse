"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, PageIntro } from "@/components/UI";
import { getDefaultPolicyContent } from "@/lib/legal-documents";

type PolicyType = "PRIVASI" | "KETENTUAN";
type PolicyStatus = "DRAFT" | "DITINJAU" | "TERBIT";

type Policy = {
  id: string;
  jenis: PolicyType;
  versi: string;
  status: PolicyStatus;
  contentId: string;
  contentEn: string;
  terbitPada: string | null;
  typeLabel: string;
  statusLabel: string;
};

type PolicyDraft = {
  id?: string;
  type: PolicyType;
  version: string;
  status: PolicyStatus;
  contentId: string;
  contentEn: string;
};

type ApiResult = {
  error?: { message?: string };
};

function isPolicyType(value: string): value is PolicyType {
  return value === "PRIVASI" || value === "KETENTUAN";
}

function isPolicyStatus(value: string): value is PolicyStatus {
  return value === "DRAFT" || value === "DITINJAU" || value === "TERBIT";
}

function createDraft(type: PolicyType): PolicyDraft {
  const defaults = getDefaultPolicyContent(type);
  return {
    type,
    version: "",
    status: "DRAFT",
    contentId: defaults.id,
    contentEn: defaults.en,
  };
}

export function AdminPoliciesManager() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadPolicies = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/policies", { cache: "no-store" });
      const result: { policies?: Policy[]; error?: { message?: string } } = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal memuat dokumen hukum.");
      setPolicies(result.policies ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat dokumen hukum.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/policies", { cache: "no-store" })
      .then(async (response) => {
        const result: { policies?: Policy[]; error?: { message?: string } } = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Gagal memuat dokumen hukum.");
        if (active) setPolicies(result.policies ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Gagal memuat dokumen hukum.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function editPolicy(policy: Policy) {
    setError("");
    setNotice("");
    const defaults = getDefaultPolicyContent(policy.jenis);
    setDraft({
      id: policy.id,
      type: policy.jenis,
      version: policy.versi,
      status: policy.status,
      contentId: policy.contentId || defaults.id,
      contentEn: policy.contentEn || defaults.en,
    });
  }

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        draft.id ? `/api/admin/policies/${encodeURIComponent(draft.id)}` : "/api/admin/policies",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: draft.type,
            version: draft.version,
            status: draft.status,
            content: { id: draft.contentId, en: draft.contentEn },
          }),
        },
      );
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menyimpan dokumen hukum.");

      setDraft(null);
      setNotice("Dokumen hukum berhasil disimpan.");
      await loadPolicies();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan dokumen hukum.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePolicy(policy: Policy) {
    if (!window.confirm(`Hapus ${policy.typeLabel} versi ${policy.versi}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingId(policy.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/policies/${encodeURIComponent(policy.id)}`, { method: "DELETE" });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Gagal menghapus dokumen hukum.");
      setPolicies((current) => current.filter((item) => item.id !== policy.id));
      setNotice("Dokumen hukum berhasil dihapus.");
      if (draft?.id === policy.id) setDraft(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus dokumen hukum.");
    } finally {
      setDeletingId("");
    }
  }

  function changeDraft<K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
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
          title="Kelola kebijakan"
          description="Kelola versi dan isi Kebijakan Privasi serta Ketentuan Layanan."
        />
        <div className="notice warning">
          Dokumen hanya tampil di halaman publik setelah berstatus Terbit. Terbitkan hanya naskah yang sudah ditinjau dan disetujui.
        </div>
        {error && (
          <div className="notice warning" role="alert">
            {error}{" "}
            {error.includes("Silakan masuk") && <Link className="text-link" href="/admin">Masuk sebagai admin</Link>}
          </div>
        )}
        {notice && <div className="notice" role="status">{notice}</div>}
        <div className="panel-card">
          <div className="panel-head">
            <h2 style={{ fontSize: 20 }}>Dokumen hukum</h2>
            <Button onClick={() => { setError(""); setNotice(""); setDraft(createDraft("PRIVASI")); }}>
              + Tambah dokumen
            </Button>
          </div>
          {loading ? (
            <p role="status">Memuat dokumen hukum...</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Dokumen</th><th>Versi</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {policies.map((policy) => (
                    <tr key={policy.id}>
                      <td>{policy.typeLabel}</td>
                      <td>{policy.versi}</td>
                      <td>{policy.statusLabel}</td>
                      <td>
                        <button className="text-link" type="button" onClick={() => editPolicy(policy)}>Edit</button>
                        {"　"}
                        <button
                          className="text-link"
                          type="button"
                          disabled={deletingId === policy.id}
                          onClick={() => void deletePolicy(policy)}
                        >
                          {deletingId === policy.id ? "Menghapus..." : "Hapus"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {policies.length === 0 && (
                    <tr><td colSpan={4}>Belum ada dokumen hukum di database.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {draft && (
          <form className="panel-card form-stack" onSubmit={savePolicy}>
            <h2 style={{ fontSize: 20 }}>{draft.id ? "Edit dokumen hukum" : "Tambah dokumen hukum"}</h2>
            <label className="field">
              <span>Jenis dokumen</span>
              <select
                value={draft.type}
                onChange={(event) => {
                  if (isPolicyType(event.target.value)) {
                    const type = event.target.value;
                    const defaults = getDefaultPolicyContent(type);
                    setDraft((current) => current ? {
                      ...current,
                      type,
                      contentId: defaults.id,
                      contentEn: defaults.en,
                    } : current);
                  }
                }}
                disabled={saving || Boolean(draft.id)}
              >
                <option value="PRIVASI">Kebijakan Privasi</option>
                <option value="KETENTUAN">Ketentuan Layanan</option>
              </select>
            </label>
            <label className="field">
              <span>Versi</span>
              <input
                value={draft.version}
                onChange={(event) => changeDraft("version", event.target.value)}
                maxLength={50}
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,49}"
                placeholder="contoh: 2026-11-v1"
                required
                disabled={saving}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={draft.status}
                onChange={(event) => {
                  if (isPolicyStatus(event.target.value)) changeDraft("status", event.target.value);
                }}
                disabled={saving}
              >
                <option value="DRAFT">Draft</option>
                <option value="DITINJAU">Perlu tinjauan</option>
                <option value="TERBIT">Terbit (ditampilkan ke publik)</option>
              </select>
            </label>
            <label className="field">
              <span>Isi dokumen — Bahasa Indonesia</span>
              <textarea
                value={draft.contentId}
                onChange={(event) => changeDraft("contentId", event.target.value)}
                maxLength={100000}
                rows={14}
                placeholder="Masukkan isi lengkap dokumen Bahasa Indonesia."
                required={draft.status === "TERBIT"}
                disabled={saving}
              />
            </label>
            <label className="field">
              <span>Isi dokumen — English</span>
              <textarea
                value={draft.contentEn}
                onChange={(event) => changeDraft("contentEn", event.target.value)}
                maxLength={100000}
                rows={14}
                placeholder="Enter the complete English version of the legal document."
                required={draft.status === "TERBIT"}
                disabled={saving}
              />
            </label>
            <div className="hero-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan dokumen"}
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>
                Batal
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
