import { AttemptStatus } from "@/lib/generated/prisma/enums";
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
