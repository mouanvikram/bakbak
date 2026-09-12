export const DEFAULT_PAGE_SIZE = 50;

// Translates a `{ cursor, limit }` list query into Prisma's cursor-pagination
// args. A cursor page continues just after the given id (`skip: 1` past the
// cursor row — Prisma's way of saying "after id"); no cursor means the first
// page. Defaults to `DEFAULT_PAGE_SIZE` rows when no limit is given.

export function cursorPaginationArgs(
  cursor: string | undefined,
  limit: number | undefined,
): {
  cursor?: { id: string };
  skip?: number;
  take: number;
} {
  return {
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : undefined,
    take: limit ?? DEFAULT_PAGE_SIZE,
  };
}