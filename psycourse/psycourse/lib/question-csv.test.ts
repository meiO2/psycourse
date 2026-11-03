import { describe, expect, it } from "vitest";
import { ContentStatus } from "@/lib/generated/prisma/enums";
import { parseQuestionCsv } from "@/lib/question-csv";

describe("parseQuestionCsv", () => {
  it("parses quoted commas and converts the answer to a zero-based index", () => {
    const result = parseQuestionCsv(
      'question,choices,answer,explanation,status\r\n"Pola angka, lanjutannya?","10 | 12 | 16 | 32",4,"Setiap angka dikali dua.",Draft\r\n',
    );

    expect(result).toEqual({
      rows: [
        {
          teks: "Pola angka, lanjutannya?",
          pilihan: ["10", "12", "16", "32"],
          kunciJawaban: 3,
          penjelasan: "Setiap angka dikali dua.",
          status: ContentStatus.DRAFT,
        },
      ],
    });
  });

  it("supports reordered headers, UTF-8 BOM, and embedded newlines", () => {
    const result = parseQuestionCsv(
      '\uFEFFchoices,explanation,answer,question\r\n"A | B","Baris satu\nBaris dua",1,"Soal"\r\n',
    );

    expect(result).toEqual({
      rows: [
        {
          teks: "Soal",
          pilihan: ["A", "B"],
          kunciJawaban: 0,
          penjelasan: "Baris satu\nBaris dua",
          status: ContentStatus.DRAFT,
        },
      ],
    });
  });

  it("rejects a missing required column", () => {
    expect(parseQuestionCsv("question,choices,answer\nq,A | B,1")).toEqual({
      error: "Kolom wajib tidak ditemukan: explanation.",
    });
  });

  it("rejects invalid answer indexes and duplicate questions", () => {
    expect(parseQuestionCsv("question,choices,answer,explanation\nq,A | B,3,x")).toEqual({
      error: "Jawaban pada baris 2 harus berupa nomor pilihan 1–2.",
    });
    expect(parseQuestionCsv("question,choices,answer,explanation\nq,A | B,1,x\nq,A | B,2,y")).toEqual({
      error: "Pertanyaan duplikat ditemukan pada baris 3.",
    });
  });

  it("rejects malformed CSV quoting and unsupported statuses", () => {
    expect(parseQuestionCsv('question,choices,answer,explanation\n"q,A | B,1,x')).toEqual({
      error: "Ada tanda kutip yang belum ditutup di baris 2.",
    });
    expect(parseQuestionCsv("question,choices,answer,explanation,status\nq,A | B,1,x,Published!")).toEqual({
      error: "Status pada baris 2 harus Draft, Aktif, atau Nonaktif.",
    });
  });

  it("maps Ready status to active database content", () => {
    const result = parseQuestionCsv("question,choices,answer,explanation,status\nq,A | B,1,x,Ready");
    expect("rows" in result && result.rows[0].status).toBe(ContentStatus.AKTIF);
  });
});
