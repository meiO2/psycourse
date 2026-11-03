import { QuizError } from "./domain-errors";

export type PublicQuestion = {
  id: string;
  urutan: number;
  teks: string;
  pilihan: string[];
};

export function choicesOf(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((choice) => typeof choice === "string")) {
    throw new QuizError("INVALID_CHOICE", 400, "Pilihan soal tidak valid.");
  }
  return value;
}

export function toPublicQuestion(question: {
  id: string;
  urutan: number;
  teks: string;
  pilihan: unknown;
  kunciJawaban?: number;
  penjelasan?: string;
  status?: string;
}): PublicQuestion {
  return {
    id: question.id,
    urutan: question.urutan,
    teks: question.teks,
    pilihan: choicesOf(question.pilihan),
  };
}
