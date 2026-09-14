import { mock } from "bun:test";

/**
 * Replace the real `web-push` client for the entire test run (imported from
 * `tests/setup.ts`, so it lands before any app module loads).
 *
 * `web-push` performs real HTTP requests to push services over the network;
 * every message-send test would otherwise hammer them. `sendNotification` is
 * a plain mock, so suites can assert on delivery.
 */
export type PushSendNotification = (
  subscription: unknown,
  payload?: unknown,
  options?: unknown,
) => Promise<{ statusCode: number; headers: Record<string, string> }>;

export const webPushMock = {
  setVapidDetails: mock(() => {}),
  // Shape loosely mirrors the real return value (`statusCode: 201`).
  sendNotification: mock<PushSendNotification>(
    async () => ({ statusCode: 201, headers: {} }),
  ),
  setGCMAPIKey: mock(() => {}),
  generateVAPIDKeys: mock(() => ({
    publicKey: "BTestPublicKeyForBakBak",
    privateKey: "testPrivateKeyForBakBak",
  })),
};

mock.module("web-push", () => ({
  ...webPushMock,
  default: webPushMock,
}));