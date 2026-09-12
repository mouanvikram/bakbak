import { describe, expect, test } from "bun:test";
import { cursorPaginationArgs, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

describe("cursorPaginationArgs", () => {
  test("first page: no cursor, no skip, default take", () => {
    const args = cursorPaginationArgs(undefined, undefined);
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
    expect(args.take).toBe(DEFAULT_PAGE_SIZE);
  });

  test("applies the caller's limit as take", () => {
    expect(cursorPaginationArgs(undefined, 25)).toMatchObject({ take: 25 });
  });

  test("cursor paginates after the given id", () => {
    expect(cursorPaginationArgs("3f7c1a1e-0000-0000-0000-000000000001", undefined)).toEqual({
      cursor: { id: "3f7c1a1e-0000-0000-0000-000000000001" },
      skip: 1,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  test("combines cursor and limit", () => {
    expect(cursorPaginationArgs("3f7c1a1e-0000-0000-0000-000000000002", 10)).toEqual({
      cursor: { id: "3f7c1a1e-0000-0000-0000-000000000002" },
      skip: 1,
      take: 10,
    });
  });
});