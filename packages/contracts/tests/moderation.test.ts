import { describe, expect, test } from "bun:test";
import {
  DISALLOWED_CONTROL_CHARS_RE,
  containsOffensiveContent,
  normalizeForStorage,
} from "../src/moderation";
import {
  usernameSchema,
  bioSchema,
  nameFieldSchema,
  displayNameFieldSchema,
} from "../src/shared";

describe("containsOffensiveContent", () => {
  test("matches plain profanity and slurs", () => {
    expect(containsOffensiveContent("fuck")).toBe(true);
    expect(containsOffensiveContent("you are a piece of shit")).toBe(true);
    expect(containsOffensiveContent("that nigger joke was vile")).toBe(true);
  });

  test("matches stretched, leetspeak, and lookalike-letter variants", () => {
    expect(containsOffensiveContent("fuuuuuuuck")).toBe(true);
    expect(containsOffensiveContent("a$$")).toBe(true);
    expect(containsOffensiveContent("\u0283\ud835\udc1f\u0283\u1f76\u0188\uff4b")).toBe(true);
  });

  test("does not false-positive on innocent words", () => {
    expect(containsOffensiveContent("bananas")).toBe(false);
    expect(containsOffensiveContent("the pen is mightier than the sword")).toBe(false);
    expect(containsOffensiveContent("these grapes are really yummy")).toBe(false);
    expect(containsOffensiveContent("scunthorpe")).toBe(false);
    expect(containsOffensiveContent("hello world how are you")).toBe(false);
  });
});

describe("normalizeForStorage (NFKC)", () => {
  test("folds fullwidth, compatibility, and lookalike characters", () => {
    expect(normalizeForStorage("\uff21\uff22\uff23")).toBe("ABC");
    expect(normalizeForStorage("\ufb01le")).toBe("file");
    expect(normalizeForStorage("e\u0301")).toBe("\u00e9");
  });

  test("leaves plain ASCII and lowercase unchanged", () => {
    expect(normalizeForStorage("johndoe_42")).toBe("johndoe_42");
  });
});

describe("DISALLOWED_CONTROL_CHARS_RE", () => {
  test("flags zero-width spaces, bidi overrides, and BOM", () => {
    expect(DISALLOWED_CONTROL_CHARS_RE.test("\u200bhello")).toBe(true);
    expect(DISALLOWED_CONTROL_CHARS_RE.test("\u202ehello")).toBe(true);
    expect(DISALLOWED_CONTROL_CHARS_RE.test("\ufeffhello")).toBe(true);
  });

  test("allows tab, newline, and carriage return", () => {
    expect(DISALLOWED_CONTROL_CHARS_RE.test("line1\nline2")).toBe(false);
  });
});

describe("usernameSchema", () => {
  test("accepts alphanumeric and dotted usernames", () => {
    expect(usernameSchema.parse("john.doe1")).toBe("john.doe1");
    expect(usernameSchema.parse("johndoe1")).toBe("johndoe1");
    expect(usernameSchema.parse("  AlIce42  ")).toBe("alice42");
  });

  test("rejects hyphens and underscores", () => {
    expect(usernameSchema.safeParse("john-doe").success).toBe(false);
    expect(usernameSchema.safeParse("john_doe").success).toBe(false);
  });

  test("rejects homoglyphs and non-ASCII letters", () => {
    expect(usernameSchema.safeParse("joh\u043f").success).toBe(false); // Cyrillic п
    expect(usernameSchema.safeParse("jos\u00e9").success).toBe(false); // é
    expect(usernameSchema.safeParse("\u73e9").success).toBe(false); // 中文
    expect(usernameSchema.safeParse("Jane Doe").success).toBe(false); // space + caps
  });

  test("rejects profanity", () => {
    expect(usernameSchema.safeParse("fuck").success).toBe(false);
    expect(usernameSchema.safeParse("a\u0421\u0421").success).toBe(false); // "ass" via Cyrillic АС
  });
});

describe("bioSchema", () => {
  test("accepts null and normal bios", () => {
    expect(bioSchema.parse(null)).toBeNull();
    expect(bioSchema.parse("a normal bio to enjoy reading")).toBe("a normal bio to enjoy reading");
  });

  test("NFKC-folds fullwidth text before length checks", () => {
    const parsed = bioSchema.parse("\uff21\uff22\uff23 hello world welcome bio text");
    expect(parsed).toContain("ABC hello world welcome bio text");
  });

  test("rejects profanity, zero-width padding, and control chars", () => {
    expect(bioSchema.safeParse("fuck off this bio is not allowed").success).toBe(false);
    expect(bioSchema.safeParse("hello world this bio\u200bis sneaky").success).toBe(false);
    expect(bioSchema.safeParse("hello world this bio\u202eorder is flipped").success).toBe(false);
  });
});

describe("nameFieldSchema vs displayNameFieldSchema", () => {
  test("names keep Unicode and fold NFC into NFKC form", () => {
    expect(nameFieldSchema.parse("Jos\u00e9")).toBe("Jos\u00e9");
    expect(displayNameFieldSchema.parse("S\u00e9bastien")).toBe("S\u00e9bastien");
    expect(nameFieldSchema.parse("  \uff2d\uff41\uff52\uff4b  ")).toBe("Mark");
  });

  test("display name is screened for profanity", () => {
    expect(displayNameFieldSchema.safeParse("FuckFace").success).toBe(false);
    expect(nameFieldSchema.safeParse("FuckFace").success).toBe(true);
  });

  test("both reject zero-width characters", () => {
    expect(nameFieldSchema.safeParse("Jo\u200bh").success).toBe(false);
    expect(displayNameFieldSchema.safeParse("Jo\u200bh").success).toBe(false);
  });
});