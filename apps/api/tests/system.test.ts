import "./setup";
import { mock } from "bun:test";
import {
	beforeAll,
	afterAll,
	describe,
	test,
	expect,
} from "bun:test";
import { createServer } from "node:http";
import app from "../src/app";
import { isDatabaseAvailable } from "./helpers";

mock.module("resend", () => ({
	Resend: class {
		emails = { send: mock(() => Promise.resolve({ data: {}, error: null })) };
	},
}));

const DB_AVAILABLE = await isDatabaseAvailable();

describe("System", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;

	beforeAll(async () => {
		if (!DB_AVAILABLE) return;
		server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, resolve));
		const address = server.address();
		port = typeof address === "string" ? parseInt(address) : address!.port;
	});

	afterAll(async () => {
		if (server) await new Promise<void>((r) => server.close(() => r()));
	});

	test("GET /api/v1/version - reports the running build (public, no auth)", async () => {
		const res = await fetch(`http://localhost:${port}/api/v1/version`);
		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(typeof data.version).toBe("string");
		expect(typeof data.commit).toBe("string");
		expect(typeof data.buildTime).toBe("string");
		// Unstamped local/CI env falls back to "dev".
		expect(data.version.length).toBeGreaterThan(0);
	});
});
