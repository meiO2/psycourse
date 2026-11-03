import { requireUser } from "@/lib/auth";
import { withQuizErrors } from "@/lib/quiz/errors";
import { startAttempt } from "@/lib/quiz/service";

export const POST = withQuizErrors(async (_request, context: { params: Promise<{ slug: string }> }) => {
  const user = await requireUser();
  const { slug } = await context.params;
  return Response.json(await startAttempt(user.id, slug), { status: 201 });
});
