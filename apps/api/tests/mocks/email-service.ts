import { mock } from "bun:test";

/**
 * Replace the real `EmailService` for the entire test run.
 *
 * The real one builds a Resend client at module load and its `sendEmail()`
 * actually delivers mail (to `DEV_EMAIL` even outside production) — every
 * signup / reset / 2FA test would send a real, billed email. The per-file
 * `mock.module("resend", …)` calls don't help: most test files `import "../src/app"`
 * *before* mocking, so `email/service.ts` has already captured the real client
 * by the time the mock registers.
 *
 * This file is imported from `tests/setup.ts`, which `bun test --preload` runs
 * before any test file, so no import order can leak a real send.
 *
 * `sendTwoFactorCode` is a real (no-op) method so `spyOn(emailService,
 * "sendTwoFactorCode")` in the auth tests can still read the generated code.
 */
export class MockEmailService {
	async sendEmail(_dto: {
		to: string | null;
		subject: string;
		html: string;
	}): Promise<void> {}

	async sendVerificationEmail(_dto: {
		username: string;
		email: string;
		url: string;
	}): Promise<void> {}

	async sendPasswordResetEmail(_dto: {
		email: string;
		subject: string;
		resetPasswordUrl: string;
	}): Promise<void> {}

	async sendTwoFactorCode(_dto: {
		email: string;
		username: string;
		code: string;
		expiresInMinutes: number;
	}): Promise<void> {}
}

mock.module("../../src/email/service", () => ({
	EmailService: MockEmailService,
}));
