import { describe, expect, it } from "vitest";
import { AttemptStatus } from "@/lib/generated/prisma/enums";
import { QuizError } from "./domain-errors";
import { assertAttemptCanReceiveAnswer, deadlineFor, finalizationStatus, isPastDeadline } from "./policy";

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
    expect(isPastDeadline(deadline, new Date(deadline.getTime() + 1))).toBe(true);
  });

  it("does not assign a deadline to Test 1", () => {
    expect(deadlineFor("TEST_1", null, new Date("2026-10-31T14:00:00.000Z"))).toBeNull();
    expect(deadlineFor("TEST_1", 60, new Date("2026-10-31T14:00:00.000Z"))).toBeNull();
  });

  it("calculates a Test 2 deadline from the server start time", () => {
    const startedAt = new Date("2026-10-31T14:00:00.000Z");
    const deadline = deadlineFor("TEST_2", 90, startedAt);

    expect(deadline).toEqual(new Date("2026-10-31T14:01:30.000Z"));
    expect(deadline).not.toBe(startedAt);
  });

  it.each([null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid Test 2 timer %s",
    (timerDetik) => {
      expect(() => deadlineFor("TEST_2", timerDetik, new Date("2026-10-31T14:00:00.000Z"))).toThrowError(QuizError);
    },
  );

  it("selects normal completion before the deadline and expiry at or after it", () => {
    const deadline = new Date("2026-10-31T14:00:10.000Z");
    expect(finalizationStatus(deadline, new Date("2026-10-31T14:00:09.999Z"))).toBe(AttemptStatus.SELESAI);
    expect(finalizationStatus(deadline, deadline)).toBe(AttemptStatus.KEDALUWARSA);
    expect(finalizationStatus(deadline, new Date("2026-10-31T14:00:10.001Z"))).toBe(AttemptStatus.KEDALUWARSA);
    expect(finalizationStatus(null, new Date("2026-10-31T14:00:10.001Z"))).toBe(AttemptStatus.SELESAI);
  });
});
