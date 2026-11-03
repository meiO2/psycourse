import { requireUser } from "@/lib/auth";
import { withQuizErrors } from "@/lib/quiz/errors";
import { getResult } from "@/lib/quiz/service";

export const GET = withQuizErrors(async (_request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await context.params;
  return Response.json({ result: await getResult(user.id, id) });
});
