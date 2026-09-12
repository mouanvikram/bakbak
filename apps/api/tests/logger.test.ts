import { describe, expect, test } from "bun:test";
import { createLogger, LOG_REDACT_PATHS } from "@/lib/logger";

function captureSink() {
  const lines: string[] = [];
  const sink = { write: (msg: string) => void lines.push(msg) };
  return { lines, sink };
}

function parse(msg: string): Record<string, unknown> {
  return JSON.parse(msg);
}

describe("logger redaction", () => {
  test("LOG_REDACT_PATHS covers every sensitive field family", () => {
    for (const path of [
      "password",
      "*.password",
      "currentPassword",
      "newPassword",
      "passwordHash",
      "token",
      "*.token",
      "refreshToken",
      "*.refreshToken",
    ]) {
      expect(LOG_REDACT_PATHS).toContain(path);
    }
    expect(LOG_REDACT_PATHS).toContain("req.headers.authorization");
    expect(LOG_REDACT_PATHS).toContain("body.code");
  });

  test("top-level sensitive fields are censored, benign fields pass through", () => {
    const { lines, sink } = captureSink();
    const log = createLogger(sink);

    log.info(
      {
        password: "hunter2",
        newPassword: "hunter3",
        currentPassword: "hunter4",
        passwordHash: "deadbeef",
        token: "abc",
        tokenHash: "def",
        hashedToken: "ghi",
        accessToken: "jkl",
        refreshToken: "mno",
        authorization: "Bearer secret",
        ok: "visible",
        count: 3,
      },
      "hello",
    );

    const record = parse(lines[0]!);
    expect(record.password).toBe("[redacted]");
    expect(record.newPassword).toBe("[redacted]");
    expect(record.currentPassword).toBe("[redacted]");
    expect(record.passwordHash).toBe("[redacted]");
    expect(record.token).toBe("[redacted]");
    expect(record.tokenHash).toBe("[redacted]");
    expect(record.hashedToken).toBe("[redacted]");
    expect(record.accessToken).toBe("[redacted]");
    expect(record.refreshToken).toBe("[redacted]");
    expect(record.authorization).toBe("[redacted]");
    expect(record.ok).toBe("visible");
    expect(record.count).toBe(3);
    expect(record.msg).toBe("hello");
  });

  test("nested sensitive fields (headers, 2FA code) are censored", () => {
    const { lines, sink } = captureSink();
    const log = createLogger(sink);

    log.info({
      req: { headers: { authorization: "Bearer zzz" } },
      body: { code: "123456" },
    });

    const record = parse(lines[0]!);
    const req = record.req as { headers: { authorization: unknown } };
    const body = record.body as { code: unknown };
    expect(req.headers.authorization).toBe("[redacted]");
    expect(body.code).toBe("[redacted]");
  });
});