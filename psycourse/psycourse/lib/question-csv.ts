import { ContentStatus } from "@/lib/generated/prisma/enums";

export type ImportedQuestion = {
  teks: string;
  pilihan: string[];
  kunciJawaban: number;
  penjelasan: string;
  status: ContentStatus;
};

type CsvParseResult = { rows: ImportedQuestion[] } | { error: string };

function parseCsvRecords(input: string): { records: { line: number; cells: string[] }[] } | { error: string } {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let recordLine = 1;
  let quoted = false;
  let afterQuote = false;

  const finishRecord = () => {
    cells.push(cell);
    if (cells.some((value) => value.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
    recordLine = line + 1;
    afterQuote = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += char;
        if (char === "\n") line += 1;
      }
      continue;
    }

    if (afterQuote && char !== "," && char !== "\r" && char !== "\n" && char.trim() !== "") {
      return { error: `Format CSV tidak valid di baris ${line}.` };
    }
    if (afterQuote && char !== "\r" && char !== "\n" && char.trim() === "") continue;

    if (char === '"') {
      if (cell.length !== 0) return { error: `Format CSV tidak valid di baris ${line}.` };
      quoted = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
      afterQuote = false;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && next === "\n") index += 1;
      finishRecord();
      line += 1;
    } else {
      cell += char;
    }
  }

  if (quoted) return { error: `Ada tanda kutip yang belum ditutup di baris ${recordLine}.` };
  if (cell !== "" || cells.length > 0) finishRecord();
  return { records };
}

function parseStatus(value: string, line: number): ContentStatus | { error: string } {
  const normalized = value.trim().toLocaleLowerCase("id-ID");
  if (!normalized || normalized === "draft" || normalized === "draf") return ContentStatus.DRAFT;
  if (
    normalized === "ready" ||
    normalized === "siap" ||
    normalized === "aktif" ||
    normalized === "active" ||
    normalized === "published" ||
    normalized === "dipublikasikan"
  ) {
    return ContentStatus.AKTIF;
  }
  if (normalized === "nonaktif" || normalized === "inactive") return ContentStatus.NONAKTIF;
  return { error: `Status pada baris ${line} harus Draft, Aktif, atau Nonaktif.` };
}

export function parseQuestionCsv(input: string): CsvParseResult {
  const parsed = parseCsvRecords(input.replace(/^\uFEFF/, ""));
  if ("error" in parsed) return parsed;
  const [headerRecord, ...dataRecords] = parsed.records;
  if (!headerRecord) return { error: "CSV kosong." };

  const headers = headerRecord.cells.map((header) => header.trim().toLocaleLowerCase("id-ID"));
  if (new Set(headers).size !== headers.length) return { error: "Nama kolom CSV tidak boleh duplikat." };

  const required = ["question", "choices", "answer", "explanation"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return { error: `Kolom wajib tidak ditemukan: ${missing.join(", ")}.` };
  }
  if (dataRecords.length === 0) return { error: "CSV belum berisi soal." };
  if (dataRecords.length > 500) return { error: "Maksimal 500 soal per impor." };

  const column = (name: string) => headers.indexOf(name);
  const rows: ImportedQuestion[] = [];
  const seenQuestions = new Set<string>();

  for (const record of dataRecords) {
    if (record.cells.length !== headers.length) {
      return { error: `Jumlah kolom pada baris ${record.line} tidak sesuai dengan header.` };
    }

    const value = (name: string) => record.cells[column(name)]?.trim() ?? "";
    const teks = value("question");
    const pilihan = value("choices").split("|").map((choice) => choice.trim());
    const answerText = value("answer");
    const explanation = value("explanation");
    const answerNumber = Number(answerText);

    if (!teks) return { error: `Pertanyaan pada baris ${record.line} tidak boleh kosong.` };
    if (pilihan.length < 2 || pilihan.some((choice) => !choice)) {
      return { error: `Minimal dua pilihan tidak kosong diperlukan pada baris ${record.line}; pisahkan pilihan dengan |.` };
    }
    if (!Number.isInteger(answerNumber) || answerNumber < 1 || answerNumber > pilihan.length) {
      return { error: `Jawaban pada baris ${record.line} harus berupa nomor pilihan 1–${pilihan.length}.` };
    }

    const normalizedQuestion = teks.toLocaleLowerCase("id-ID");
    if (seenQuestions.has(normalizedQuestion)) {
      return { error: `Pertanyaan duplikat ditemukan pada baris ${record.line}.` };
    }
    seenQuestions.add(normalizedQuestion);

    const status = parseStatus(value("status"), record.line);
    if (typeof status === "object") return status;

    rows.push({
      teks,
      pilihan,
      kunciJawaban: answerNumber - 1,
      penjelasan: explanation,
      status,
    });
  }

  return { rows };
}
