import { describe, expect, it } from "vitest";
import { toPublicQuestion } from "./question-mapper";
import { calculateScore } from "./scoring";

describe("quiz service", () => {
  it("calculates one point for each matching answer and no points for blank answers", () => {
    expect(
      calculateScore([
        { pilihan: 1, question: { kunciJawaban: 1 } },
        { pilihan: 0, question: { kunciJawaban: 2 } },
      ]),
    ).toBe(1);
  });

  it("excludes answer keys and explanations from public questions", () => {
    const publicQuestion = toPublicQuestion({
      id: "question-1",
      urutan: 1,
      teks: "Pilih jawaban.",
      pilihan: ["A", "B"],
      kunciJawaban: 1,
      status: "AKTIF",
    });

    expect(publicQuestion).toEqual({
      id: "question-1",
      urutan: 1,
      teks: "Pilih jawaban.",
      pilihan: ["A", "B"],
    });
    expect(publicQuestion).not.toHaveProperty("kunciJawaban");
    expect(publicQuestion).not.toHaveProperty("penjelasan");
  });
});
