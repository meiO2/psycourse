import { requireUser } from "@/lib/auth";
import { withQuizErrors } from "@/lib/quiz/errors";
import { getTest } from "@/lib/quiz/service";

export const GET = withQuizErrors(async (_request, context: { params: Promise<{ slug: string }> }) => {
  await requireUser();
  const { slug } = await context.params;
  return Response.json({ test: await getTest(slug) });
});
