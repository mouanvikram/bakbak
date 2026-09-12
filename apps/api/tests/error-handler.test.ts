import "./setup";
import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import express from "express";
import { Prisma } from "@bakbak/db";
import { errorHandler } from "@/middleware/error.middleware";

// A message shaped like the real thing: table/field names a client must never see.
const PRISMA_MESSAGE =
  "Invalid `prisma.friendRequest.create()` invocation: Unique constraint failed on the fields: (`senderId`,`receiverId`)";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(PRISMA_MESSAGE, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ["senderId", "receiverId"], modelName: "FriendRequest" },
  });
}

// Throws from an async handler, exactly like the controllers do — this also
// proves Express 5 forwards the rejection to the error handler.
async function requestWithError(error: unknown) {
  const app = express();
  app.get("/boom", async () => {
    throw error;
  });
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    const port =
      typeof address === "string" ? parseInt(address) : address!.port;
    const res = await fetch(`http://localhost:${port}/boom`);
    return { status: res.status, text: await res.text() };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

function expectNoPrismaLeak(text: string) {
  expect(text).not.toContain("prisma");
  expect(text).not.toContain("Unique constraint");
  expect(text).not.toContain("senderId");
  expect(text).not.toContain("FriendRequest");
  expect(text).not.toMatch(/P20\d\d/);
}

describe("errorHandler — Prisma known request errors", () => {
  test.each([
    ["P2002", 409, "CONFLICT"],
    ["P2003", 404, "NOT_FOUND"],
    ["P2025", 404, "NOT_FOUND"],
    ["P2023", 400, "BAD_REQUEST"],
  ])(
    "%s maps to %d %s without leaking Prisma details",
    async (code, status, errorCode) => {
      const res = await requestWithError(prismaError(code));

      expect(res.status).toBe(status);
      expect(JSON.parse(res.text).error.code).toBe(errorCode);
      expectNoPrismaLeak(res.text);
    },
  );

  test("an unmapped Prisma code is a generic 500, still without Prisma details", async () => {
    const res = await requestWithError(prismaError("P2034"));

    expect(res.status).toBe(500);
    expect(JSON.parse(res.text).error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
    expectNoPrismaLeak(res.text);
  });
});
