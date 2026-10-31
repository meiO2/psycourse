export function calculateScore(
  answers: Array<{ pilihan: number; question: { kunciJawaban: number } }>,
): number {
  return answers.reduce((score, answer) => score + (answer.pilihan === answer.question.kunciJawaban ? 1 : 0), 0);
}
