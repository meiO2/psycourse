import { db } from "@/lib/db";
import { AttemptStatus, type ContentStatus, type TestType } from "@/lib/generated/prisma/enums";
import type { TransactionClient } from "@/lib/generated/prisma/internal/prismaNamespace";
import { assertQuizAccess } from "./access";
import { QuizError } from "./domain-errors";
import { choicesOf, toPublicQuestion } from "./question-mapper";
import { assertAttemptCanReceiveAnswer, isPastDeadline } from "./policy";
import { calculateScore } from "./scoring";

type TestWithQuestions = {
  id: string;
  categoryId: string;
  slug: string;
  tipe: TestType;
  timerDetik: number | null;
  status: ContentStatus;
  category: { slug: string; judul: string };
  questions: Array<{
    id: string;
    urutan: number;
    teks: string;
    pilihan: unknown;
    kunciJawaban: number;
    status: ContentStatus;
  }>;
};

type AttemptResult = {
  attemptId: string;
  status: AttemptStatus;
  skor: number;
  totalSoal: number;
  persentase: number;
  expired: boolean;
  mulaiPada: Date;
  deadlineAt: Date | null;
  selesaiPada: Date | null;
};

function resultOf(attempt: {
  id: string;
  status: AttemptStatus;
  skor: number | null;
  totalSoal: number;
  mulaiPada: Date;
  deadlineAt: Date | null;
  selesaiPada: Date | null;
}): AttemptResult {
  const skor = attempt.skor ?? 0;
  return {
    attemptId: attempt.id,
    status: attempt.status,
    skor,
    totalSoal: attempt.totalSoal,
    persentase: attempt.totalSoal === 0 ? 0 : Math.round((skor / attempt.totalSoal) * 100),
    expired: attempt.status === AttemptStatus.KEDALUWARSA,
    mulaiPada: attempt.mulaiPada,
    deadlineAt: attempt.deadlineAt,
    selesaiPada: attempt.selesaiPada,
  };
}

async function lockAttempt(tx: TransactionClient, attemptId: string, userId?: string): Promise<void> {
  const rows =
    userId === undefined
      ? await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Attempt" WHERE "id" = ${attemptId} FOR UPDATE
        `
      : await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Attempt" WHERE "id" = ${attemptId} AND "userId" = ${userId} FOR UPDATE
        `;
  if (rows.length === 0) throw new QuizError("ATTEMPT_NOT_FOUND", 404, "Percobaan tidak ditemukan.");
}

async function finalizeLockedAttempt(
  tx: TransactionClient,
  attemptId: string,
  status: AttemptStatus,
): Promise<AttemptResult> {
  const attempt = await tx.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: { include: { question: { select: { kunciJawaban: true } } } } },
  });
  if (attempt.status !== AttemptStatus.BERLANGSUNG) return resultOf(attempt);

  const skor = calculateScore(attempt.answers);
  const updated = await tx.attempt.update({
    where: { id: attempt.id },
    data: { status, skor, selesaiPada: new Date() },
  });
  return resultOf(updated);
}

async function activeTest(slug: string): Promise<TestWithQuestions> {
  const test = await db.test.findFirst({
    where: { slug, status: "AKTIF" },
    select: {
      id: true,
      categoryId: true,
      slug: true,
      tipe: true,
      timerDetik: true,
      status: true,
      category: { select: { slug: true, judul: true } },
      questions: {
        where: { status: "AKTIF" },
        orderBy: { urutan: "asc" },
        select: { id: true, urutan: true, teks: true, pilihan: true, kunciJawaban: true, status: true },
      },
    },
  });
  if (!test) throw new QuizError("TEST_NOT_FOUND", 404, "Tes tidak ditemukan.");
  if (test.questions.length === 0) throw new QuizError("NO_ACTIVE_QUESTIONS", 409, "Tes belum memiliki soal aktif.");
  return test;
}

function deadlineFor(test: TestWithQuestions, startedAt: Date): Date | null {
  if (test.tipe !== "TEST_2") return null;
  const timerDetik = test.timerDetik;
  if (timerDetik === null || !Number.isInteger(timerDetik) || timerDetik <= 0) {
    throw new QuizError("TEST_NOT_FOUND", 409, "Konfigurasi waktu tes tidak valid.");
  }
  return new Date(startedAt.getTime() + timerDetik * 1000);
}

export async function getTest(slug: string) {
  const test = await activeTest(slug);
  return {
    id: test.id,
    slug: test.slug,
    tipe: test.tipe,
    timerDetik: test.timerDetik,
    totalSoal: test.questions.length,
    category: test.category,
  };
}

export async function startAttempt(userId: string, slug: string) {
  const test = await activeTest(slug);
  await assertQuizAccess(userId, test);
  const mulaiPada = new Date();
  const attempt = await db.attempt.create({
    data: {
      userId,
      testId: test.id,
      status: AttemptStatus.BERLANGSUNG,
      mulaiPada,
      deadlineAt: deadlineFor(test, mulaiPada),
      totalSoal: test.questions.length,
    },
  });
  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      mulaiPada: attempt.mulaiPada,
      deadlineAt: attempt.deadlineAt,
      totalSoal: attempt.totalSoal,
    },
    test: { id: test.id, slug: test.slug, tipe: test.tipe, timerDetik: test.timerDetik, category: test.category },
    questions: test.questions.map(toPublicQuestion),
    serverNow: new Date(),
  };
}

export async function getAttempt(userId: string, attemptId: string) {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      test: { select: { id: true, slug: true, tipe: true, timerDetik: true, category: { select: { slug: true, judul: true } } } },
      answers: { select: { questionId: true, pilihan: true } },
    },
  });
  if (!attempt) throw new QuizError("ATTEMPT_NOT_FOUND", 404, "Percobaan tidak ditemukan.");

  if (attempt.status === AttemptStatus.BERLANGSUNG && attempt.deadlineAt && attempt.deadlineAt.getTime() <= Date.now()) {
    await expireAttempt(userId, attemptId);
    return getAttempt(userId, attemptId);
  }

  const questions = await db.question.findMany({
    where: { testId: attempt.testId, status: "AKTIF" },
    orderBy: { urutan: "asc" },
    select: { id: true, urutan: true, teks: true, pilihan: true, kunciJawaban: true, status: true },
  });
  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      mulaiPada: attempt.mulaiPada,
      deadlineAt: attempt.deadlineAt,
      selesaiPada: attempt.selesaiPada,
      totalSoal: attempt.totalSoal,
      skor: attempt.status === AttemptStatus.BERLANGSUNG ? null : attempt.skor,
    },
    test: attempt.test,
    questions: questions.map(toPublicQuestion),
    answers: attempt.answers,
    serverNow: new Date(),
  };
}

export async function saveAnswer(userId: string, attemptId: string, questionId: string, pilihan: number) {
  if (!Number.isInteger(pilihan)) throw new QuizError("INVALID_CHOICE", 400, "Pilihan jawaban tidak valid.");
  return db.$transaction(async (tx) => {
    await lockAttempt(tx, attemptId, userId);
    const attempt = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    assertAttemptCanReceiveAnswer(attempt.status);
    if (isPastDeadline(attempt.deadlineAt, new Date())) {
      await finalizeLockedAttempt(tx, attemptId, AttemptStatus.KEDALUWARSA);
      throw new QuizError("ATTEMPT_EXPIRED", 409, "Waktu tes sudah habis.");
    }
    const question = await tx.question.findFirst({
      where: { id: questionId, testId: attempt.testId, status: "AKTIF" },
      select: { id: true, pilihan: true },
    });
    if (!question) throw new QuizError("INVALID_QUESTION", 400, "Soal bukan bagian dari percobaan ini.");
    const choices = choicesOf(question.pilihan);
    if (pilihan < 0 || pilihan >= choices.length) throw new QuizError("INVALID_CHOICE", 400, "Pilihan jawaban tidak valid.");
    await tx.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, pilihan },
      update: { pilihan },
    });
    return { saved: true, questionId, pilihan };
  });
}

export async function expireAttempt(userId: string, attemptId: string) {
  return db.$transaction(async (tx) => {
    await lockAttempt(tx, attemptId, userId);
    const attempt = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.status !== AttemptStatus.BERLANGSUNG) return resultOf(attempt);
    if (!isPastDeadline(attempt.deadlineAt, new Date())) return resultOf(attempt);
    return finalizeLockedAttempt(tx, attemptId, AttemptStatus.KEDALUWARSA);
  });
}

export async function submitAttempt(userId: string, attemptId: string) {
  return db.$transaction(async (tx) => {
    await lockAttempt(tx, attemptId, userId);
    const attempt = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.status !== AttemptStatus.BERLANGSUNG) return resultOf(attempt);
    const status =
      isPastDeadline(attempt.deadlineAt, new Date())
        ? AttemptStatus.KEDALUWARSA
        : AttemptStatus.SELESAI;
    return finalizeLockedAttempt(tx, attemptId, status);
  });
}

export async function getResult(userId: string, attemptId: string) {
  const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId } });
  if (!attempt) throw new QuizError("ATTEMPT_NOT_FOUND", 404, "Percobaan tidak ditemukan.");
  if (attempt.status === AttemptStatus.BERLANGSUNG && isPastDeadline(attempt.deadlineAt, new Date())) {
    await expireAttempt(userId, attemptId);
    return getResult(userId, attemptId);
  }
  if (attempt.status === AttemptStatus.BERLANGSUNG) throw new QuizError("ATTEMPT_FINISHED", 409, "Percobaan belum dikirim.");
  return resultOf(attempt);
}
