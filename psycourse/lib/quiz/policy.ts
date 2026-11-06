import { AttemptStatus, type TestType } from "@/lib/generated/prisma/enums";
import { QuizError } from "./domain-errors";

export function assertAttemptCanReceiveAnswer(status: AttemptStatus): void {
  if (status === AttemptStatus.BERLANGSUNG) return;
  throw new QuizError(
    status === AttemptStatus.KEDALUWARSA ? "ATTEMPT_EXPIRED" : "ATTEMPT_FINISHED",
    409,
    "Percobaan sudah selesai.",
  );
}

export function isPastDeadline(deadlineAt: Date | null, now: Date): boolean {
  return deadlineAt !== null && deadlineAt.getTime() <= now.getTime();
}

export function deadlineFor(
  testType: TestType,
  timerDetik: number | null,
  startedAt: Date,
): Date | null {
  if (testType !== "TEST_2") return null;
  if (timerDetik === null || !Number.isInteger(timerDetik) || timerDetik <= 0) {
    throw new QuizError("TEST_NOT_FOUND", 409, "Konfigurasi waktu tes tidak valid.");
  }
  return new Date(startedAt.getTime() + timerDetik * 1000);
}

export function finalizationStatus(deadlineAt: Date | null, now: Date): AttemptStatus {
  return isPastDeadline(deadlineAt, now) ? AttemptStatus.KEDALUWARSA : AttemptStatus.SELESAI;
}
