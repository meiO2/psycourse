import { beforeEach, describe, expect, it, vi } from "vitest";

const { autoSubmitMock } = vi.hoisted(() => ({
  autoSubmitMock: vi.fn(),
}));

vi.mock("@/lib/quiz/auto-submit", () => ({
  autoSubmitExpiredAttempts: autoSubmitMock,
}));
vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {},
}));

import { POST } from "./route";

const secret = "test-internal-scheduler-secret";
const context = { params: Promise.resolve({}) };

function request(options: { authorization?: string; body?: unknown } = {}) {
  return new Request("http://localhost/api/internal/quiz/auto-submit", {
    method: "POST",
    headers: {
      ...(options.authorization ? { authorization: options.authorization } : {}),
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

describe("internal auto-submit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INTERNAL_SCHEDULER_SECRET;
    delete process.env.AUTO_SUBMIT_BATCH_SIZE;
  });

  it("rejects requests when the scheduler secret is not configured", async () => {
    const response = await POST(request({ authorization: `Bearer ${secret}` }), context);

    expect(response.status).toBe(401);
    expect(autoSubmitMock).not.toHaveBeenCalled();
  });

  it("rejects requests without authorization", async () => {
    process.env.INTERNAL_SCHEDULER_SECRET = secret;

    const response = await POST(request(), context);

    expect(response.status).toBe(401);
    expect(autoSubmitMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    process.env.INTERNAL_SCHEDULER_SECRET = secret;

    const response = await POST(request({ authorization: "Bearer invalid" }), context);

    expect(response.status).toBe(401);
    expect(autoSubmitMock).not.toHaveBeenCalled();
  });

  it("calls auto-submit with the configured server batch size", async () => {
    process.env.INTERNAL_SCHEDULER_SECRET = secret;
    process.env.AUTO_SUBMIT_BATCH_SIZE = "25";
    autoSubmitMock.mockResolvedValue({ processed: 2, skipped: 1, failed: 0 });

    const response = await POST(request({ authorization: `Bearer ${secret}` }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { processed: 2, skipped: 1, failed: 0 } });
    expect(autoSubmitMock).toHaveBeenCalledWith(25);
  });

  it("does not allow a request payload to control processing", async () => {
    process.env.INTERNAL_SCHEDULER_SECRET = secret;
    autoSubmitMock.mockResolvedValue({ processed: 0, skipped: 0, failed: 0 });

    const response = await POST(
      request({
        authorization: `Bearer ${secret}`,
        body: { batchSize: 1, score: 999, status: "SELESAI", userId: "attacker" },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(autoSubmitMock).toHaveBeenCalledWith();
  });

  it("returns a safe server error when auto-submit fails", async () => {
    process.env.INTERNAL_SCHEDULER_SECRET = secret;
    autoSubmitMock.mockRejectedValue(new Error("database details must not leak"));

    const response = await POST(request({ authorization: `Bearer ${secret}` }), context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "SERVER_ERROR", message: "Terjadi kesalahan. Coba lagi nanti." },
    });
  });

  it("rejects an invalid configured batch size without calling the service", async () => {
    process.env.INTERNAL_SCHEDULER_SECRET = secret;
    process.env.AUTO_SUBMIT_BATCH_SIZE = "101";

    const response = await POST(request({ authorization: `Bearer ${secret}` }), context);

    expect(response.status).toBe(500);
    expect(autoSubmitMock).not.toHaveBeenCalled();
  });
});
