import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import express from "express";
import type { Router } from "express";
import {
  createHealthzRouter,
  createReadyzRouter,
  runReadinessChecks,
  type ReadinessCheckers,
} from "@/system/health";

const allOk: ReadinessCheckers = {
  database: () => Promise.resolve(true),
  redis: () => Promise.resolve(true),
  storage: () => Promise.resolve(true),
  email: () => Promise.resolve(true),
};

async function request(router: Router) {
  const app = express();
  app.use("/", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    const port = typeof address === "string" ? parseInt(address) : address!.port;
    return await fetch(`http://localhost:${port}/`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

type HealthBody = {
  status: string;
  checks?: {
    database: boolean;
    redis: boolean;
    storage: boolean;
    email: boolean;
  };
};

describe("runReadinessChecks", () => {
  test("all healthy -> ok", async () => {
    const report = await runReadinessChecks(allOk);
    expect(report.status).toBe("ok");
    expect(report.checks).toEqual({
      database: true,
      redis: true,
      storage: true,
      email: true,
    });
  });

  test("database down -> unhealthy (critical)", async () => {
    const report = await runReadinessChecks({
      ...allOk,
      database: () => Promise.resolve(false),
    });
    expect(report.status).toBe("unhealthy");
  });

  test("redis down -> unhealthy (critical)", async () => {
    const report = await runReadinessChecks({
      ...allOk,
      redis: () => Promise.resolve(false),
    });
    expect(report.status).toBe("unhealthy");
  });

  test("storage down -> degraded (non-critical)", async () => {
    const report = await runReadinessChecks({
      ...allOk,
      storage: () => Promise.resolve(false),
    });
    expect(report.status).toBe("degraded");
  });

  test("email down -> degraded (non-critical)", async () => {
    const report = await runReadinessChecks({
      ...allOk,
      email: () => Promise.resolve(false),
    });
    expect(report.status).toBe("degraded");
  });
});

describe("health endpoints", () => {
  test("GET /healthz always answers ok (liveness, no checks)", async () => {
    const res = await request(createHealthzRouter());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("GET /readyz healthy -> 200 ok", async () => {
    const res = await request(createReadyzRouter(allOk));
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({
      database: true,
      redis: true,
      storage: true,
      email: true,
    });
  });

  test("GET /readyz degraded (storage down) -> 200 degraded", async () => {
    const res = await request(
      createReadyzRouter({ ...allOk, storage: () => Promise.resolve(false) }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as HealthBody).status).toBe("degraded");
  });

  test("GET /readyz database down -> 503, no error detail leaked", async () => {
    const res = await request(
      createReadyzRouter({ ...allOk, database: () => Promise.resolve(false) }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe("unhealthy");
    expect(body.checks?.database).toBe(false);
    // Only booleans and an enum — never error text or hostnames.
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|localhost|postgres/i);
  });
});