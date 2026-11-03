import { describe, expect, it } from "vitest";
import { AttemptStatus } from "@/lib/generated/prisma/enums";
import { QuizError } from "./domain-errors";
import { assertAttemptCanReceiveAnswer, isPastDeadline } from "./policy";

describe("quiz attempt policy", () => {
  it("allows answers only while an attempt is in progress", () => {
    expect(() => assertAttemptCanReceiveAnswer(AttemptStatus.BERLANGSUNG)).not.toThrow();
    expect(() => assertAttemptCanReceiveAnswer(AttemptStatus.SELESAI)).toThrowError(QuizError);
    expect(() => assertAttemptCanReceiveAnswer(AttemptStatus.KEDALUWARSA)).toThrowError(QuizError);
  });

  it("treats the exact deadline as expired", () => {
    const deadline = new Date("2026-10-31T14:00:00.000Z");
    expect(isPastDeadline(deadline, deadline)).toBe(true);
    expect(isPastDeadline(deadline, new Date(deadline.getTime() - 1))).toBe(false);
  });
});
