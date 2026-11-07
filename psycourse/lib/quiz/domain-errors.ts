export class QuizError extends Error {
  constructor(
    public readonly code:
      | "TEST_NOT_FOUND"
      | "NO_ACTIVE_QUESTIONS"
      | "ATTEMPT_NOT_FOUND"
      | "ATTEMPT_FINISHED"
      | "ATTEMPT_EXPIRED"
      | "INVALID_QUESTION"
      | "INVALID_CHOICE"
      | "ACCESS_CHECK_UNAVAILABLE"
      | "TEST_ACCESS_DENIED",
    public readonly status: 400 | 403 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
