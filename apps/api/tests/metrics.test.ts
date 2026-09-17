import "./setup";
import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import express from "express";
import {
  createMetricsRouter,
  httpMetricsMiddleware,
  httpRequestsTotal,
} from "@/system/metrics";

async function withServer<T>(
  app: express.Express,
  fn: (base: string) => Promise<T>,
): Promise<T> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    const port = typeof address === "string" ? parseInt(address) : address!.port;
    return await fn(`http://localhost:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

async function scrapeMetrics(base: string): Promise<string> {
  // The metric is written on res "finish"; poll briefly to avoid a race.
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${base}/metrics`);
    const text = await res.text();
    if (!/http_requests_total/.test(text) || text.includes(`route="/ping"`)) {
      return text;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return "";
}

describe("Prometheus metrics", () => {
  afterEach(() => {
    // Keep the counter from leaking between scrape assertions.
    httpRequestsTotal.reset();
  });

  test("GET /metrics returns Prometheus text format with process metrics", async () => {
    await withServer(
      express().use("/metrics", createMetricsRouter()),
      async (base) => {
        const res = await fetch(`${base}/metrics`);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/plain");
        const text = await res.text();
        expect(text).toContain("# HELP");
        // Default OS/Node metrics are collected.
        expect(text).toMatch(
          /process_cpu_seconds_total|nodejs_heap_size_total_bytes/,
        );
      },
    );
  });

  test("http_requests_total records the matched route pattern", async () => {
    const app = express();
    app.use(httpMetricsMiddleware);
    app.get("/ping", (_req, res) => res.json({ ok: true }));
    app.use("/metrics", createMetricsRouter());

    await withServer(app, async (base) => {
      await fetch(`${base}/ping`);
      await fetch(`${base}/ping`);

      const text = await scrapeMetrics(base);
      expect(text).toContain(
        'http_requests_total{method="GET",status="200",route="/ping"} 2',
      );
      expect(text).toContain(
        'http_request_duration_seconds_count{method="GET",status="200",route="/ping"} 2',
      );
    });
  });
});