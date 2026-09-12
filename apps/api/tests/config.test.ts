import "./setup";
import { afterEach, describe, expect, test } from "bun:test";
import {
  isProduction,
  requiredAlways,
  requiredInProduction,
} from "@/config/required";

const originalNodeEnv = process.env.NODE_ENV;

function asProduction<T>(run: () => T): T {
  process.env.NODE_ENV = "production";
  return run();
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("config/required", () => {
  test("isProduction only tracks NODE_ENV=production", () => {
    expect(isProduction()).toBe(false);
    process.env.NODE_ENV = "staging";
    expect(isProduction()).toBe(false);
    expect(asProduction(isProduction)).toBe(true);
  });

  describe("requiredInProduction", () => {
    test("falls back to the dev default outside production", () => {
      expect(
        requiredInProduction(undefined, "STORAGE_SECRET_KEY", {
          insecureDevDefault: "minioadmin",
        }),
      ).toBe("minioadmin");

      expect(
        requiredInProduction(undefined, "STORAGE_BUCKET", {
          devDefault: "bakbak",
        }),
      ).toBe("bakbak");
    });

    test("throws in production when the value is missing", () => {
      expect(() =>
        asProduction(() =>
          requiredInProduction(undefined, "STORAGE_SECRET_KEY", {
            insecureDevDefault: "minioadmin",
          }),
        ),
      ).toThrow(/STORAGE_SECRET_KEY is missing/);
    });

    test("throws in production when the dev credential is set explicitly", () => {
      expect(() =>
        asProduction(() =>
          requiredInProduction("minioadmin", "STORAGE_SECRET_KEY", {
            insecureDevDefault: "minioadmin",
          }),
        ),
      ).toThrow(/still the local development value/);
    });

    test("a safe dev default is still accepted in production", () => {
      expect(
        asProduction(() =>
          requiredInProduction("bakbak", "STORAGE_BUCKET", {
            devDefault: "bakbak",
          }),
        ),
      ).toBe("bakbak");
    });

    test("accepts a real production value", () => {
      expect(
        asProduction(() =>
          requiredInProduction("  s3.example.com  ", "STORAGE_ENDPOINT", {
            insecureDevDefault: "localhost",
          }),
        ),
      ).toBe("s3.example.com");
    });
  });

  describe("requiredAlways", () => {
    test("throws outside production when missing", () => {
      expect(() => requiredAlways("", "JWT_SECRET")).toThrow(
        /JWT_SECRET is missing/,
      );
    });

    test("skips the length floor outside production", () => {
      expect(
        requiredAlways("test-secret", "JWT_SECRET", { minLength: 32 }),
      ).toBe("test-secret");
    });

    test("enforces the length floor in production", () => {
      expect(() =>
        asProduction(() =>
          requiredAlways("test-secret", "JWT_SECRET", { minLength: 32 }),
        ),
      ).toThrow(/is 11 characters; production requires at least 32/);

      const strong = "x".repeat(32);
      expect(
        asProduction(() =>
          requiredAlways(strong, "JWT_SECRET", { minLength: 32 }),
        ),
      ).toBe(strong);
    });
  });
});
