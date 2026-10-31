import { requireUser } from "@/lib/auth";
import { withQuizErrors } from "@/lib/quiz/errors";
import { submitAttempt } from "@/lib/quiz/service";

export const POST = withQuizErrors(async (_request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await context.params;
  return Response.json({ result: await submitAttempt(user.id, id) });
});
