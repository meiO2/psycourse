import { sampleQuestions } from "../lib/data";

const fixtureSource = "Fixture Practice lokal (lib/data.ts)";

type PracticeQuestionData = {
  testId: string;
  urutan: number;
  teks: string;
  pilihan: string[];
  kunciJawaban: number;
  penjelasan: string;
  status: "AKTIF";
  dibuatDengan: string;
};

type QuestionStore = {
  question: {
    count(args: { where: { testId: string } }): Promise<number>;
    createMany(args: { data: PracticeQuestionData[] }): Promise<unknown>;
  };
};

type PracticeFixtureStore = QuestionStore & {
  $transaction<T>(callback: (transaction: QuestionStore) => Promise<T>): Promise<T>;
};

export async function ensurePracticeFixture(
  db: PracticeFixtureStore,
  testId: string,
): Promise<boolean> {
  if (await db.question.count({ where: { testId } }) > 0) return false;

  return db.$transaction(async (transaction) => {
    if (await transaction.question.count({ where: { testId } }) > 0) return false;

    await transaction.question.createMany({
      data: sampleQuestions.map((question, index) => ({
        testId,
        urutan: index + 1,
        teks: question.question,
        pilihan: question.choices,
        kunciJawaban: question.answer,
        penjelasan: question.explanation,
        status: "AKTIF" as const,
        dibuatDengan: fixtureSource,
      })),
    });
    return true;
  });
}
