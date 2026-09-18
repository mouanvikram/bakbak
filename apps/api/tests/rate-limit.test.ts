import "./setup";
import { describe, test, expect } from "bun:test";
import { getRedisClient, isRedisReady } from "@/redis/client";
import { checkAndApplyLimit } from "@/redis/rate-limit";
import { AppError, HTTP_STATUS } from "@/errors/app-error";

const client = getRedisClient();

// (client is created for its side effect: a fast CLI probe of the shared
// connection, so isRedisReady() below reflects the real link.)
void client;

const REDIS_AVAILABLE = await Promise.race([
  (async () => {
    while (!isRedisReady()) await new Promise((r) => setTimeout(r, 20));
    return true;
  })(),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)),
]);

describe.skipIf(!REDIS_AVAILABLE)("Rate-limit middleware", () => {
  // Isolated bucket keys so these tests can never touch a production bucket
  // (the per-IP login/email buckets are shared across the whole test suite).
  // Stored once per test: the middleware rebuilds its options from this key on
  // every request, so it must not change per call or the bucket resets.
  const passKey = `rl:test:isolated:pass:${Date.now()}`;
  const limitKey = `rl:test:isolated:limit:${Date.now()}`;

  const makeMiddleware = (key: string) =>
    checkAndApplyLimit(() => ({
      key,
      capacity: 2,
      refillRate: 1 / 100,
      cost: 1,
    }));

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

  test("lets requests through within capacity and reports the remaining budget", async () => {
    const middleware = makeMiddleware(passKey);
    const res = fakeRes();
    let passed = false;

    await middleware(fakeReq() as never, res as never, () => {
      passed = true;
    });

    expect(passed).toBe(true);
    expect(res.header("RateLimit-Limit")).toBe("2");
    expect(res.header("RateLimit-Remaining")).toBe("1");
  });

  test("returns 429 + Retry-After once the bucket is exhausted", async () => {
    const middleware = makeMiddleware(limitKey);
    await middleware(fakeReq() as never, fakeRes() as never, () => {});
    await middleware(fakeReq() as never, fakeRes() as never, () => {});

    const res = fakeRes();
    const err = await middleware(
      fakeReq() as never,
      res as never,
      () => {},
    ).catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect((err as AppError).code).toBe("RATE_LIMIT_EXCEEDED");
    expect(res.header("Retry-After")).toBeDefined();
  });
});