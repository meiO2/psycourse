import { requireAdmin } from "@/lib/auth";
import { apiError, readJson, validationError, withErrors } from "@/lib/api";
import { ContentStatus, TestType } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

const statusLabels: Record<ContentStatus, string> = {
  [ContentStatus.DRAFT]: "Draft",
  [ContentStatus.AKTIF]: "Aktif",
  [ContentStatus.NONAKTIF]: "Nonaktif",
};

export const GET = withErrors(async (request) => {
  if (!request.headers.has("cookie")) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  await requireAdmin();

  const categories = await db.category.findMany({
    orderBy: { urutan: "asc" },
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

  return Response.json({
    courses: categories.map((category) => ({
      ...category,
      statusLabel: statusLabels[category.status],
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = withErrors(async (request) => {
  await requireAdmin();
  const body = await readJson(request);
  if (!body) return validationError("Data course tidak valid.");

  const judul = typeof body.judul === "string" ? body.judul.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const ikon = typeof body.ikon === "string" ? body.ikon.trim() : "";
  const warna = typeof body.warna === "string" ? body.warna.trim() : "";
  const subjudul = typeof body.subjudul === "string" ? body.subjudul.trim() : "";
  const deskripsi = typeof body.deskripsi === "string" ? body.deskripsi.trim() : "";

  if (!judul || judul.length > 100) return validationError("Nama course wajib diisi, maksimal 100 karakter.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    return validationError("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");
  }
  if (!ikon || ikon.length > 100) return validationError("Ikon wajib dipilih.");
  if (!/^#[0-9a-fA-F]{6}$/.test(warna)) return validationError("Warna harus berupa kode HEX, misalnya #2F855A.");
  if (subjudul.length > 200) return validationError("Subjudul maksimal 200 karakter.");
  if (deskripsi.length > 5000) return validationError("Deskripsi maksimal 5.000 karakter.");

  try {
    const category = await db.$transaction(async (transaction) => {
      const lastCategory = await transaction.category.aggregate({ _max: { urutan: true } });
      const created = await transaction.category.create({
        data: {
          slug,
          judul,
          subjudul,
          ikon,
          warna,
          deskripsi,
          urutan: (lastCategory._max.urutan ?? -1) + 1,
          status: ContentStatus.DRAFT,
          tests: {
            create: [
              {
                slug: `${slug}-test-1`,
                tipe: TestType.TEST_1,
                status: ContentStatus.DRAFT,
              },
              {
                slug: `${slug}-test-2`,
                tipe: TestType.TEST_2,
                timerDetik: 600,
                status: ContentStatus.DRAFT,
              },
              {
                slug: `${slug}-practice`,
                tipe: TestType.PRACTICE,
                status: ContentStatus.DRAFT,
              },
            ],
          },
        },
        select: { id: true },
      });
      return created;
    });

    return Response.json({ id: category.id }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return apiError("COURSE_SLUG_EXISTS", "Slug tersebut sudah digunakan course lain.", 409);
    }
    throw error;
  }
});
