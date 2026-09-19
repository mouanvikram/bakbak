import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register,
} from "prom-client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { systemConfig } from "./config";

// Node/OS process metrics (CPU, memory, event-loop lag, handles, etc.).
collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests, labeled by method, HTTP status and route pattern.",
  labelNames: ["method", "status", "route"],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "status", "route"],
  // Sub-seconds up to 10s — the API targets sub-100ms responses.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

/**
 * Records every request on completion. Uses the matched route pattern
 * (e.g. "/api/v1/users/:username") so cardinality stays bounded; requests
 * that never match a route are bucketed as "unmatched".
 */
export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      status: String(res.statusCode),
      route: req.route?.path ?? "unmatched",
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
}

// Length must not leak through timing: compare padded copies so both branches
// burn the same time regardless of how the headers differ.
function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

function isAuthorizedMetricsRequest(
  req: Request,
  configuredToken: string,
): boolean {
  const header = req.headers.authorization;
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  return !!token && constantTimeEqual(token, configuredToken);
}

/**
 * Prometheus text-format scrape endpoint. Behind a Bearer token whenever
 * METRICS_AUTH_TOKEN is set; with no token configured it stays public so local
 * dev (and the test suite) scrape without setup.
 */
export function createMetricsRouter(
  opts: { authToken?: string } = {},
): Router {
  const authToken = opts.authToken ?? systemConfig.metricsAuthToken;
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    if (authToken && !isAuthorizedMetricsRequest(req, authToken)) {
      res
        .setHeader("WWW-Authenticate", 'Bearer realm="metrics"')
        .status(401)
        .type("text/plain")
        .end("unauthorized");
      return;
    }
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(await register.metrics());
  });
  return router;
}
