import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { ContentStatus } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function isContentStatus(value: string): value is ContentStatus {
  return Object.values(ContentStatus).some((status) => status === value);
}

export const PATCH = withErrors(async (request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return validationError("Data course tidak valid.");

  const current = await db.category.findUnique({ where: { id }, select: { id: true } });
  if (!current) return apiError("COURSE_NOT_FOUND", "Course tidak ditemukan.", 404);

  const data: {
    slug?: string;
    judul?: string;
    subjudul?: string;
    ikon?: string;
    warna?: string;
    deskripsi?: string;
    urutan?: number;
    status?: ContentStatus;
  } = {};

  if ("judul" in body) {
    if (typeof body.judul !== "string" || !body.judul.trim() || body.judul.trim().length > 100) {
      return validationError("Nama course wajib diisi, maksimal 100 karakter.");
    }
    data.judul = body.judul.trim();
  }
  if ("slug" in body) {
    if (
      typeof body.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug.trim()) ||
      body.slug.trim().length > 100
    ) {
      return validationError("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");
    }
    data.slug = body.slug.trim();
  }
  if ("subjudul" in body) {
    if (typeof body.subjudul !== "string" || body.subjudul.trim().length > 200) {
      return validationError("Subjudul maksimal 200 karakter.");
    }
    data.subjudul = body.subjudul.trim();
  }
  if ("ikon" in body) {
    if (typeof body.ikon !== "string" || !body.ikon.trim() || body.ikon.trim().length > 100) {
      return validationError("Ikon wajib diisi, maksimal 100 karakter.");
    }
    data.ikon = body.ikon.trim();
  }
  if ("warna" in body) {
    if (typeof body.warna !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.warna.trim())) {
      return validationError("Warna harus berupa kode HEX, misalnya #2F855A.");
    }
    data.warna = body.warna.trim();
  }
  if ("deskripsi" in body) {
    if (typeof body.deskripsi !== "string" || body.deskripsi.trim().length > 5000) {
      return validationError("Deskripsi maksimal 5.000 karakter.");
    }
    data.deskripsi = body.deskripsi.trim();
  }
  if ("urutan" in body) {
    if (typeof body.urutan !== "number" || !Number.isInteger(body.urutan) || body.urutan < 0 || body.urutan > 10000) {
      return validationError("Urutan harus berupa bilangan bulat antara 0 dan 10.000.");
    }
    data.urutan = body.urutan;
  }
  if ("status" in body) {
    if (typeof body.status !== "string" || !isContentStatus(body.status)) {
      return validationError("Status harus Draft, Aktif, atau Nonaktif.");
    }
    data.status = body.status;
  }
  if (Object.keys(data).length === 0) return validationError("Tidak ada perubahan course.");

  try {
    const updated = await db.category.update({
      where: { id },
      data,
      select: {
        id: true,
        slug: true,
        judul: true,
        subjudul: true,
        ikon: true,
        warna: true,
        deskripsi: true,
        urutan: true,
        status: true,
      },
    });
    return Response.json(updated);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return apiError("COURSE_SLUG_EXISTS", "Slug tersebut sudah digunakan course lain.", 409);
    }
    throw error;
  }
});

export const DELETE = withErrors(async (_request, { params }: RouteContext) => {
  await requireAdmin();
  const { id } = await params;
  const course = await db.category.findUnique({
    where: { id },
    select: {
      id: true,
      tests: {
        select: {
          id: true,
          _count: { select: { attempts: true } },
        },
      },
    },
  });
  if (!course) return apiError("COURSE_NOT_FOUND", "Course tidak ditemukan.", 404);

  if (course.tests.some((test) => test._count.attempts > 0)) {
    return apiError(
      "COURSE_HAS_ATTEMPTS",
      "Course tidak dapat dihapus karena sudah memiliki riwayat pengerjaan tes.",
      409,
    );
  }

  const entitlements = await db.entitlement.count({
    where: { testId: { in: course.tests.map((test) => test.id) } },
  });
  if (entitlements > 0) {
    return apiError(
      "COURSE_HAS_ENTITLEMENTS",
      "Course tidak dapat dihapus karena masih terhubung ke akses tes yang sudah dibeli.",
      409,
    );
  }

  await db.$transaction(async (transaction) => {
    const testIds = course.tests.map((test) => test.id);
    await transaction.question.deleteMany({ where: { testId: { in: testIds } } });
    await transaction.test.deleteMany({ where: { categoryId: id } });
    await transaction.category.delete({ where: { id } });
  });

  return Response.json({ deleted: true });
});
