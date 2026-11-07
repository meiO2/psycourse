import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { entitlement: { findFirst } },
}));

import { canAccessTest } from "./test-access-service";

describe("canAccessTest", () => {
  beforeEach(() => findFirst.mockReset());

  it("always allows Test 1 without querying entitlement", async () => {
    await expect(canAccessTest("user-1", { id: "test-1", tipe: "TEST_1" })).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("allows Test 2 for a current premium or matching single entitlement", async () => {
    findFirst.mockResolvedValue({ id: "entitlement-1" });

    await expect(canAccessTest("user-1", { id: "test-2", tipe: "TEST_2" })).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-1",
        OR: [{ packageId: "premium" }, { packageId: "single", testId: "test-2" }],
        AND: [{ OR: [{ berakhir: null }, { berakhir: { gt: expect.any(Date) } }] }],
      }),
    }));
  });

  it("denies Test 2 when no current entitlement exists or checking fails", async () => {
    findFirst.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("database unavailable"));

    await expect(canAccessTest("user-1", { id: "test-2", tipe: "TEST_2" })).resolves.toBe(false);
    await expect(canAccessTest("user-1", { id: "test-2", tipe: "TEST_2" })).resolves.toBe(false);
  });
});
