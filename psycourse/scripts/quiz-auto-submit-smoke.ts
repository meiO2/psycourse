import { execFile } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { AttemptStatus, ContentStatus, TestType } from "@/lib/generated/prisma/enums";

const execFileAsync = promisify(execFile);
const expectedHost = "127.0.0.1";
const expectedPort = 55432;
const expectedDatabase = "psycourse_test";
const expectedUser = "psycourse_test";
const serverHost = "127.0.0.1";
const serverPort = 3217;
const schedulerSecret = `smoke-${crypto.randomUUID()}`;

function requireTestingUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) throw new Error("TEST_DATABASE_URL wajib diisi untuk smoke test.");

  const parsed = new URL(raw);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const username = decodeURIComponent(parsed.username);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL harus menggunakan PostgreSQL.");
  }
  if (
    parsed.hostname !== expectedHost ||
    parsed.port !== String(expectedPort) ||
    database !== expectedDatabase ||
    username !== expectedUser
  ) {
    throw new Error(
      "TEST_DATABASE_URL harus menunjuk ke 127.0.0.1:55432/psycourse_test sebagai user psycourse_test.",
    );
  }
  return raw;
}

async function assertPortAvailable(): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const socket = createConnection({ host: serverHost, port: serverPort });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error(`Port ${serverPort} sedang digunakan.`));
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolvePromise();
      else reject(error);
    });
  });
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(
        `http://${serverHost}:${serverPort}/api/internal/quiz/auto-submit`,
        { method: "POST", headers: { authorization: "Bearer not-ready" } },
      );
      const body = await response.json().catch(() => null);
      if (response.status === 401 && body?.error?.code === "UNAUTHORIZED") return;
      throw new Error("Respons readiness bukan dari endpoint internal yang diharapkan.");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Respons readiness")) throw error;
      await sleep(500);
    }
  }
  throw new Error("Next.js smoke-test server tidak siap.");
}

function startServer(databaseUrl: string): ChildProcess {
  const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
  return spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", serverHost, "--port", String(serverPort)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: databaseUrl,
        INTERNAL_SCHEDULER_SECRET: schedulerSecret,
      },
      stdio: "inherit",
    },
  );
}

async function waitForPortFree(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await assertPortAvailable();
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Port ${serverPort} masih digunakan setelah cleanup process tree.`);
}

async function stopProcessTree(server: ChildProcess | undefined): Promise<void> {
  if (!server?.pid) return;
  if (process.platform !== "win32") {
    throw new Error("Cleanup process tree smoke test baru didukung pada Windows.");
  }

  const rootPid = server.pid;
  const nextPath = resolve("node_modules", "next", "dist", "bin", "next")
    .replaceAll("\\", "\\\\");
  const verifyCommand = [
    `$process = Get-CimInstance Win32_Process -Filter 'ProcessId = ${rootPid}'`,
    "if ($null -eq $process) { exit 0 }",
    `$commandLine = [string]$process.CommandLine`,
    `if ($commandLine -notmatch '${nextPath}' -or $commandLine -notmatch '--port ${serverPort}' -or $commandLine -notmatch '--hostname ${serverHost}') { exit 2 }`,
  ].join("; ");

  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      verifyCommand,
    ], { timeout: 5000 });
  } catch (error) {
    const exitCode = (error as { code?: string | number }).code;
    if (exitCode === 2) {
      throw new Error("PID smoke test tidak lagi cocok dengan command line Next.js yang dibuat script.");
    }
    if (server.exitCode !== null || server.signalCode !== null) {
      await waitForPortFree();
      console.log("Next.js process tree stopped.");
      return;
    }
    throw new Error("Tidak dapat memverifikasi PID Next.js smoke test sebelum penghentian.");
  }

  try {
    await execFileAsync("taskkill.exe", [
      "/PID",
      String(rootPid),
      "/T",
      "/F",
    ], { timeout: 10000 });
  } catch (error) {
    if (server.exitCode === null && server.signalCode === null) {
      const message = error instanceof Error ? error.message : "taskkill gagal.";
      throw new Error(`Gagal menghentikan process tree Next.js: ${message}`);
    }
  }
  await waitForPortFree();
  console.log("Next.js process tree stopped.");
}

type Database = typeof import("@/lib/db").db;

async function assertDatabaseIdentity(db: Database): Promise<void> {
  const identity = await db.$queryRaw<
    Array<{ database_name: string; current_user: string; server_port: number }>
  >`SELECT current_database() AS database_name, current_user, inet_server_port() AS server_port`;
  const [databaseIdentity] = identity;
  if (
    databaseIdentity?.database_name !== expectedDatabase ||
    databaseIdentity.current_user !== expectedUser ||
    databaseIdentity.server_port !== 5432
  ) {
    throw new Error("Identitas database smoke test tidak sesuai.");
  }
}

async function assertNoForeignExpiredAttempts(db: Database, ownedAttemptId?: string): Promise<void> {
  const candidates = await db.attempt.findMany({
    where: {
      id: ownedAttemptId ? { not: ownedAttemptId } : undefined,
      status: AttemptStatus.BERLANGSUNG,
      deadlineAt: { not: null, lte: new Date() },
      test: { tipe: TestType.TEST_2 },
    },
    select: { id: true },
  });
  if (candidates.length > 0) {
    throw new Error("Database testing memiliki attempt Test 2 expired di luar fixture smoke test.");
  }
}

async function main(): Promise<void> {
  const databaseUrl = requireTestingUrl();
  await assertPortAvailable();
  process.env.DATABASE_URL = databaseUrl;
  process.env.INTERNAL_SCHEDULER_SECRET = schedulerSecret;

  const prismaGlobal = globalThis as typeof globalThis & { prisma?: unknown };
  delete prismaGlobal.prisma;
  const { db } = await import("@/lib/db");
  let server: ChildProcess | undefined;
  let userId: string | undefined;
  let categoryId: string | undefined;
  const testIds: string[] = [];
  let testError: unknown;
  let cleanupError: unknown;

  try {
    await assertDatabaseIdentity(db);
    await assertNoForeignExpiredAttempts(db);
    server = startServer(databaseUrl);
    await waitForServer();

    const suffix = `smoke-${Date.now()}-${crypto.randomUUID()}`;
    const category = await db.category.create({
      data: {
        slug: suffix,
        judul: "Smoke Test",
        subjudul: "Smoke Test",
        ikon: "test",
        warna: "#000000",
        deskripsi: "Temporary smoke fixture",
        status: ContentStatus.AKTIF,
      },
    });
    categoryId = category.id;
    const user = await db.user.create({
      data: {
        email: `${suffix}@example.test`,
        passwordHash: "smoke-test-only",
        nama: "Smoke Test",
        emailVerified: new Date(),
      },
    });
    userId = user.id;
    const test2 = await db.test.create({
      data: {
        categoryId,
        slug: `${suffix}-test-2`,
        tipe: TestType.TEST_2,
        timerDetik: 60,
        status: ContentStatus.AKTIF,
      },
    });
    testIds.push(test2.id);
    const test1 = await db.test.create({
      data: {
        categoryId,
        slug: `${suffix}-test-1`,
        tipe: TestType.TEST_1,
        timerDetik: null,
        status: ContentStatus.AKTIF,
      },
    });
    testIds.push(test1.id);
    const question = await db.question.create({
      data: {
        testId: test2.id,
        urutan: 1,
        teks: "Smoke question",
        pilihan: ["A", "B"],
        kunciJawaban: 1,
        penjelasan: "Temporary",
        status: ContentStatus.AKTIF,
      },
    });
    const expiredAttempt = await db.attempt.create({
      data: {
        userId,
        testId: test2.id,
        status: AttemptStatus.BERLANGSUNG,
        mulaiPada: new Date(Date.now() - 120_000),
        deadlineAt: new Date(Date.now() - 10_000),
        totalSoal: 1,
      },
    });
    const test1Attempt = await db.attempt.create({
      data: {
        userId,
        testId: test1.id,
        status: AttemptStatus.BERLANGSUNG,
        mulaiPada: new Date(),
        deadlineAt: null,
        totalSoal: 0,
      },
    });
    const futureAttempt = await db.attempt.create({
      data: {
        userId,
        testId: test2.id,
        status: AttemptStatus.BERLANGSUNG,
        mulaiPada: new Date(),
        deadlineAt: new Date(Date.now() + 60_000),
        totalSoal: 1,
      },
    });
    await db.attemptAnswer.create({
      data: { attemptId: expiredAttempt.id, questionId: question.id, pilihan: 1 },
    });
    await assertNoForeignExpiredAttempts(db, expiredAttempt.id);

    const endpoint = `http://${serverHost}:${serverPort}/api/internal/quiz/auto-submit`;
    const request = (token?: string, body?: unknown) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    for (const token of [undefined, "invalid"]) {
      const response = await request(token);
      if (response.status !== 401) throw new Error("Request tanpa token/token invalid tidak ditolak.");
    }
    for (const id of [expiredAttempt.id, test1Attempt.id, futureAttempt.id]) {
      const attempt = await db.attempt.findUniqueOrThrow({ where: { id } });
      if (attempt.status !== AttemptStatus.BERLANGSUNG || attempt.skor !== null) {
        throw new Error("Request unauthorized mengubah fixture.");
      }
    }

    const response = await request(schedulerSecret, {
      score: 999,
      status: AttemptStatus.SELESAI,
      deadlineAt: "2099-01-01T00:00:00.000Z",
      kunciJawaban: 0,
    });
    const responseBody = await response.json();
    if (response.status !== 200) throw new Error("HTTP auto-submit gagal.");
    const finalized = await db.attempt.findUniqueOrThrow({ where: { id: expiredAttempt.id } });
    if (finalized.status !== AttemptStatus.KEDALUWARSA || finalized.skor !== 1 || !finalized.selesaiPada) {
      throw new Error("Status atau skor fixture expired tidak sesuai.");
    }
    await expectUnchanged(db, test1Attempt.id, futureAttempt.id);
    const repeat = await request(schedulerSecret);
    if (repeat.status !== 200) throw new Error("Request kedua gagal.");
    await expectUnchanged(db, test1Attempt.id, futureAttempt.id);
    const serialized = JSON.stringify(responseBody);
    if (serialized.includes(schedulerSecret) || serialized.includes("kunciJawaban") || serialized.includes("jawaban")) {
      throw new Error("Respons smoke test membocorkan data sensitif.");
    }
    console.log("HTTP assertions passed.");
  } catch (error) {
    testError = error;
  } finally {
    try {
      if (userId) await db.attemptAnswer.deleteMany({ where: { attempt: { userId } } });
      if (userId) await db.attempt.deleteMany({ where: { userId } });
      if (testIds.length) await db.question.deleteMany({ where: { testId: { in: testIds } } });
      if (testIds.length) await db.test.deleteMany({ where: { id: { in: testIds } } });
      if (categoryId) await db.category.delete({ where: { id: categoryId } });
      if (userId) await db.user.delete({ where: { id: userId } });
      console.log("Fixture cleanup completed.");
    } catch (error) {
      cleanupError = error;
    } finally {
      try {
        await db.$disconnect();
        console.log("Prisma disconnected.");
      } catch (error) {
        if (!cleanupError) cleanupError = error;
      } finally {
        try {
          await stopProcessTree(server);
        } catch (error) {
          if (!cleanupError) cleanupError = error;
        }
      }
    }
  }

  if (cleanupError) {
    console.error("Smoke test cleanup gagal.");
    if (testError) throw testError;
    throw cleanupError;
  }
  if (testError) throw testError;
  console.log("Smoke test completed successfully.");
}

async function expectUnchanged(db: Database, ...attemptIds: string[]): Promise<void> {
  for (const id of attemptIds) {
    const attempt = await db.attempt.findUniqueOrThrow({ where: { id } });
    if (attempt.status !== AttemptStatus.BERLANGSUNG || attempt.skor !== null) {
      throw new Error("Attempt Test 1 atau Test 2 future berubah secara tidak sah.");
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Smoke test gagal.";
  console.error(message.replace(/(?:postgres(?:ql)?):\/\/[^\s]+/gi, "postgresql://[redacted]"));
  process.exitCode = 1;
});
