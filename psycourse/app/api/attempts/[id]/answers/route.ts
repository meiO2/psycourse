import { readJson, validationError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { withQuizErrors } from "@/lib/quiz/errors";
import { saveAnswer } from "@/lib/quiz/service";

export const PUT = withQuizErrors(async (request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const body = await readJson(request);
  if (!body || typeof body.questionId !== "string" || typeof body.pilihan !== "number" || !Number.isInteger(body.pilihan)) {
    return validationError("Question dan pilihan jawaban wajib valid.");
  }
  const { id } = await context.params;
  return Response.json(await saveAnswer(user.id, id, body.questionId, body.pilihan));
});
