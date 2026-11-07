import { canAccessTest, type AccessControlledTest } from "@/lib/access/test-access-service";
import { QuizError } from "./domain-errors";

/** Adapter Quiz Engine ke aturan akses BE2 yang sama dengan endpoint publik. */
export async function assertQuizAccess(userId: string, test: AccessControlledTest): Promise<void> {
  if (await canAccessTest(userId, test)) return;
  throw new QuizError("TEST_ACCESS_DENIED", 403, "Kamu belum memiliki akses ke tes ini.");
}
