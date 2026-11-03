import { apiError } from "@/lib/api";
import { AuthError } from "@/lib/auth";
import { QuizError } from "./domain-errors";

export { QuizError } from "./domain-errors";

export function withQuizErrors<T>(handler: (request: Request, context: T) => Promise<Response>) {
  return async (request: Request, context: T): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
      if (error instanceof QuizError) return apiError(error.code, error.message, error.status);
      console.error("[quiz-api] error tak terduga:", error);
      return apiError("SERVER_ERROR", "Terjadi kesalahan. Coba lagi nanti.", 500);
    }
  };
}
