// Serializes a Date for the wire, mapping null/undefined to `null` — for
// fields that are optional in the DB row but the API contract wants `null`
// (not `undefined`) when absent.

export function toIso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}