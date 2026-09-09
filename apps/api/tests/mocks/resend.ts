import { mock } from "bun:test";

// Keep the real Resend SDK (and any network calls) out of the test run.
mock.module("resend", () => ({
  Resend: class {
    emails = {
      send: mock(() =>
        Promise.resolve({ data: { id: "test-email-id" }, error: null }),
      ),
    };
  },
}));
