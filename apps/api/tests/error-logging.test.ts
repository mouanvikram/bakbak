import "./setup";
import { mock, beforeEach, describe, expect, test } from "bun:test";

const records: Array<{
  level: "info" | "warn" | "error" | "fatal";
  fields: Record<string, unknown>;
  msg: string;
}> = [];

function capture(level: "info" | "warn" | "error" | "fatal") {
  return (fields: Record<string, unknown>, msg: string) => {
    records.push({ level, fields, msg });
  };
}

mock.module("@/lib/logger", () => ({
  default: {
    info: capture("info"),
    warn: capture("warn"),
    error: capture("error"),
    fatal: capture("fatal"),
    flush: () => Promise.resolve(),
  },
}));

const { errorHandler } = await import("@/middleware/error.middleware");
const { AppError, ERROR_CODES, HTTP_STATUS } = await import(
  "@/errors/app-error"
);

function apiErrorEntries() {
  return records.filter((r) => r.msg === "API error");
}

function callHandler(err: unknown) {
  const statuses: number[] = [];
  let body: unknown;
  const req = {
    requestId: "rid-xyz",
    method: "POST",
    originalUrl: "/api/v1/auth/register",
  };
  const res = {
    status(code: number) {
      statuses.push(code);
      return res;
    },
    json(b: unknown) {
      body = b;
      return res;
    },
  };
  errorHandler(err, req as never, res as never, (() => {}) as never);
  return { statuses, body };
}

describe("errorHandler — AppError log correlation", () => {
  beforeEach(() => {
    records.length = 0;
  });

  test("stamps AppError.requestId and emits a correlated warn entry", () => {
    const err = new AppError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      "Invalid input",
      { field: "username" },
    );

    const { statuses, body } = callHandler(err);

    expect(err.requestId).toBe("rid-xyz");
    expect(statuses).toEqual([400]);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: { field: "username" },
      },
    });

    const entry = apiErrorEntries().find((r) => r.level === "warn");
    expect(entry).toBeDefined();
    expect(entry!.fields).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      statusCode: 400,
      method: "POST",
      url: "/api/v1/auth/register",
      requestId: "rid-xyz",
      details: { field: "username" },
    });
  });

  test("5xx AppError is logged at error level", () => {
    const err = new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "Boom",
    );

    callHandler(err);

    const entry = apiErrorEntries().find((r) => r.level === "error");
    expect(entry).toBeDefined();
    expect(entry!.fields.statusCode).toBe(500);
    expect(entry!.fields.requestId).toBe("rid-xyz");
  });

  test("oversized-payload error gets a correlated warn entry", () => {
    const { statuses, body } = callHandler({ type: "entity.too.large" });

    expect(statuses).toEqual([413]);
    expect(body).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload is too large.",
      },
    });

    const entry = apiErrorEntries().find((r) => r.level === "warn");
    expect(entry).toBeDefined();
    expect(entry!.fields).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      requestId: "rid-xyz",
      method: "POST",
      url: "/api/v1/auth/register",
    });
  });
});