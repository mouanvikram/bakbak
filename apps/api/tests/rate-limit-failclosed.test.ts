import "./setup";
import { describe, test, expect } from "bun:test";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { makeRateLimiter, type LimiterStore } from "@/redis/rate-limit";

// The limiter reads client state through a small store seam (see rate-limit.ts)
// instead of a process-global mock, so these tests never touch Redis and can
// never leak a mocked module into sibling test files.
const deadStore: LimiterStore = {
  getRedisClient: () => null,
  isRedisReady: () => false,
  isRedisUnavailable: () => false,
};

const outageStore: LimiterStore = {
  // A client that was working and has since broken off — the "redis is down"
  // state a fail-closed bucket must refuse.
  getRedisClient: () => ({}) as never,
  isRedisReady: () => false,
  isRedisUnavailable: () => true,
};

const coldStartStore: LimiterStore = {
  // The first ~seconds of a fresh process: a client object that is still
  // connecting and has never been ready. Not a real outage — allow through.
  getRedisClient: () => ({}) as never,
  isRedisReady: () => false,
  isRedisUnavailable: () => false,
};

const fakeRes = () => {
  const headers: Record<string, string> = {};
  return {
    setHeader: (name: string, value: string) => {
      headers[name] = String(value);
    },
    header: (name: string) => headers[name],
  };
};

const fakeReq = () => ({ ip: "127.0.0.1" });

describe("Fail-closed rate limiting", () => {
  test("a security bucket refuses 503 + Retry-After when the store is gone", async () => {
    const middleware = makeRateLimiter(deadStore)(
      () => ({ key: "rl:test:fc-scope", capacity: 2, refillRate: 1 / 100 }),
      { failClosed: true },
    );
    const res = fakeRes();
    let passed = false;

    const err = await middleware(fakeReq() as never, res as never, () => {
      passed = true;
    }).catch((caught: unknown) => caught);

    expect(passed).toBe(false);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect((err as AppError).code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
    expect(res.header("Retry-After")).toBe("60");
  });

  test("a security bucket refuses 503 during a genuine outage, not a cold start", async () => {
    const middleware = makeRateLimiter(outageStore)(
      () => ({ key: "rl:test:fc-cold", capacity: 2, refillRate: 1 / 100 }),
      { failClosed: true },
    );

    const err = await middleware(
      fakeReq() as never,
      fakeRes() as never,
      () => {},
    ).catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
  });

  test("a cold-start process is allowed through so the first request is never a 503", async () => {
    const middleware = makeRateLimiter(coldStartStore)(
      () => ({ key: "rl:test:fc-cold", capacity: 2, refillRate: 1 / 100 }),
      { failClosed: true },
    );
    let passed = false;

    await middleware(fakeReq() as never, fakeRes() as never, () => {
      passed = true;
    });

    expect(passed).toBe(true);
  });

  test("non-security buckets still fail open while the store is gone", async () => {
    const middleware = makeRateLimiter(deadStore)(() => ({
      key: "rl:test:fo-scope",
      capacity: 2,
      refillRate: 1 / 100,
    }));
    let passed = false;

    await middleware(fakeReq() as never, fakeRes() as never, () => {
      passed = true;
    });

    expect(passed).toBe(true);
  });
});