import type { TestModel } from "@/lib/generated/prisma/models/Test";
import { QuizError } from "./domain-errors";

type QuizAccessTest = Pick<TestModel, "id" | "tipe">;

/**
 * BE2 integration seam. Entitlement rules are intentionally not implemented here.
 * BE2 should replace this adapter with its authoritative entitlement check.
 */
export async function assertQuizAccess(userId: string, test: QuizAccessTest): Promise<void> {
  void userId;
  if (test.tipe === "TEST_1") return;
  throw new QuizError(
    "ACCESS_CHECK_UNAVAILABLE",
    503,
    "Pengecekan akses untuk tipe tes ini belum tersedia.",
  );
}
