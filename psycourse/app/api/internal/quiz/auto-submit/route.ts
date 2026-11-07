import { createHash, timingSafeEqual } from "node:crypto";
import { apiError, withErrors } from "@/lib/api";
import { autoSubmitExpiredAttempts } from "@/lib/quiz/auto-submit";

export const runtime = "nodejs";

const MAX_BATCH_SIZE = 100;

function matchesSecret(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function configuredBatchSize(): number | undefined {
  const raw = process.env.AUTO_SUBMIT_BATCH_SIZE;
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
    throw new Error("AUTO_SUBMIT_BATCH_SIZE tidak valid.");
  }
  return value;
}

export const POST = withErrors(async (request: Request) => {
  const expectedSecret = process.env.INTERNAL_SCHEDULER_SECRET;
  if (!expectedSecret) {
    return apiError("UNAUTHORIZED", "Tidak diizinkan.", 401);
  }

  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) {
    return apiError("UNAUTHORIZED", "Tidak diizinkan.", 401);
  }

  const token = authorization.slice(prefix.length);
  if (!token || !matchesSecret(token, expectedSecret)) {
    return apiError("UNAUTHORIZED", "Tidak diizinkan.", 401);
  }

  const batchSize = configuredBatchSize();
  const result = batchSize === undefined
    ? await autoSubmitExpiredAttempts()
    : await autoSubmitExpiredAttempts(batchSize);

  return Response.json({ data: result });
});
