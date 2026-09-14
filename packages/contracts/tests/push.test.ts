import { describe, expect, test } from "bun:test";
import {
  pushConfigResponseSchema,
  pushSubscriptionRequestSchema,
} from "../src/push";

const VALID_ENDPOINT = "https://fcm.googleapis.com/fcm/send/test";
const VALID_KEYS = { p256dh: "A", auth: "B" };

describe("pushConfigResponseSchema", () => {
  test("accepts a configured and an unconfigured server", () => {
    expect(pushConfigResponseSchema.parse({ publicKey: "abc123" })).toEqual({
      publicKey: "abc123",
    });
    expect(pushConfigResponseSchema.parse({ publicKey: null })).toEqual({
      publicKey: null,
    });
    expect(pushConfigResponseSchema.parse({})).toEqual({
      publicKey: undefined,
    });
  });
});

describe("pushSubscriptionRequestSchema", () => {
  test("accepts a well-formed subscription", () => {
    expect(
      pushSubscriptionRequestSchema.parse({
        endpoint: VALID_ENDPOINT,
        keys: VALID_KEYS,
      }),
    ).toEqual({ endpoint: VALID_ENDPOINT, keys: VALID_KEYS });
  });

  test("rejects a non-URL endpoint", () => {
    expect(
      pushSubscriptionRequestSchema.safeParse({
        endpoint: "not-a-url",
        keys: VALID_KEYS,
      }).success,
    ).toBe(false);
  });

  test("rejects a payload without keys", () => {
    expect(
      pushSubscriptionRequestSchema.safeParse({ endpoint: VALID_ENDPOINT })
        .success,
    ).toBe(false);
  });

  test("rejects empty/invalid keys", () => {
    expect(
      pushSubscriptionRequestSchema.safeParse({
        endpoint: VALID_ENDPOINT,
        keys: { p256dh: "", auth: "B" },
      }).success,
    ).toBe(false);
    expect(
      pushSubscriptionRequestSchema.safeParse({
        endpoint: VALID_ENDPOINT,
        keys: { p256dh: "A" },
      }).success,
    ).toBe(false);
  });
});