import "server-only";
import { db } from "@/lib/db";
import type { TestType } from "@/lib/generated/prisma/enums";

/** Data tes minimum yang diperlukan untuk menentukan hak akses. */
export type AccessControlledTest = {
  id: string;
  tipe: TestType;
};

/**
 * Sumber kebenaran untuk akses tes.
 *
 * Test 1 selalu gratis. Test 2 membutuhkan entitlement premium, atau
 * entitlement single untuk test yang sama. Kegagalan query sengaja dianggap
 * tidak memiliki akses (fail closed), sehingga tes berbayar tidak terbuka saat
 * layanan entitlement sedang bermasalah.
 */
export async function canAccessTest(userId: string, test: AccessControlledTest): Promise<boolean> {
  if (test.tipe === "TEST_1") return true;

  try {
    const entitlement = await db.entitlement.findFirst({
      where: {
        userId,
        OR: [
          { packageId: "premium" },
          { packageId: "single", testId: test.id },
        ],
        AND: [{ OR: [{ berakhir: null }, { berakhir: { gt: new Date() } }] }],
      },
      select: { id: true },
    });
    return Boolean(entitlement);
  } catch (error) {
    console.error("[test-access] gagal memeriksa entitlement:", error);
    return false;
  }
}
