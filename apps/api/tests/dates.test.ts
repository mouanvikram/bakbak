import { describe, expect, test } from "bun:test";
import { toIso } from "@/lib/dates";

describe("toIso", () => {
  test("serializes a Date to an ISO string", () => {
    const date = new Date("2026-09-12T10:00:00Z");
    expect(toIso(date)).toBe("2026-09-12T10:00:00.000Z");
  });

  test("maps null to null", () => {
    expect(toIso(null)).toBeNull();
  });

  test("maps undefined to null", () => {
    expect(toIso(undefined)).toBeNull();
  });
});