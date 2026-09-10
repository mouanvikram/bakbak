import { z } from "zod";
import {
  containsOffensiveContent,
  DISALLOWED_CONTROL_CHARS_RE,
  normalizeForStorage,
} from "./moderation";

// Base rule for any plain string field: non-empty, at most `max` chars, and
// no null bytes (\0). Compose this with .trim().toLowerCase() / .regex() etc.
export const safeString = (max: number, min = 1) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^(?!.*\0)/, "Null bytes are not allowed");

// Username rules, in plain terms:
//   - always lowercased (the DB column is citext, so stored values are too)
//   - only a–z, 0–9, and "." are allowed — no lookalike letters like the
//     Cyrillic "п" in "johп", which a person could mistake for "john"
//   - no profanity
//
//   Good: "alice42", "john.doe"
//   Bad:  "johп"      -> non-ASCII lookalike
//         "John Doe"  -> uppercase + space
//         "fuck"      -> profanity
//
// Existing users with other characters keep them: this schema only runs when
// a profile is created or a username is changed (see users/service.ts).
export const usernameSchema = safeString(30, 4)
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9.]+$/,
    "Username may only contain lowercase letters, numbers, or dots",
  )
  .refine((value) => !containsOffensiveContent(value), {
    message: "Username contains language we do not allow",
  });

export const emailSchema = z.email().max(100).trim().toLowerCase();

/**
 * The shortest bio worth keeping. Shorter than this (after trimming) is stored
 * as `null` instead — e.g. "Hi" or "" become null.
 */
export const BIO_MIN_LENGTH = 10;
export const BIO_MAX_LENGTH = 500;

/**
 * Validation for a bio on write paths (signup, profile update).
 *
 *   "" / "   " / null / missing  -> stored as null
 *   "Hello world" (11 chars)     -> OK
 *   "Hi"                         -> too short, rejected
 *   fullwidth "ＡＢＣ hello..."  -> NFKC-normalised to "ABC hello..."
 *   "fuck this"                  -> profanity, rejected
 *   "hidden \u200b space"        -> invisible char, rejected
 */
export const bioSchema = z
  .string()
  .max(BIO_MAX_LENGTH, `Bio must be ${BIO_MAX_LENGTH} characters or fewer`)
  .regex(/^(?!.*\0)/, "Null bytes are not allowed")
  .nullable()
  .transform((value) => {
    const normalized = normalizeForStorage(value ?? "").trim();
    return normalized.length === 0 ? null : normalized;
  })
  .refine((value) => value === null || value.length >= BIO_MIN_LENGTH, {
    message: `Bio must be at least ${BIO_MIN_LENGTH} characters`,
  })
  .refine((value) => value === null || !DISALLOWED_CONTROL_CHARS_RE.test(value), {
    message: "Bio contains unsupported control characters",
  })
  .refine((value) => value === null || !containsOffensiveContent(value), {
    message: "Bio contains language we do not allow",
  });

/**
 * Rules for free-text profile fields (first name, last name, display name).
 * NFKC-normalises lookalike chars (Ａ→A), trims surrounding whitespace, and
 * rejects hidden control/format chars (zero-width spaces, bidi overrides).
 *
 * Names keep full Unicode on purpose — é, ñ, 中文 are real names — so they are
 * NOT restricted to ASCII. Only usernames are (see `usernameSchema`).
 */
export const profileTextField = (max: number) =>
  safeString(max)
    .transform((value) => normalizeForStorage(value).trim())
    .refine((value) => !DISALLOWED_CONTROL_CHARS_RE.test(value), {
      message: "Field contains unsupported control characters",
    });

/** First/last name (e.g. "José", "Nguyen", "李"). NOT profanity-checked on
 * purpose: real surnames like "Cummings" or places like "Scunthorpe" would
 * trip the word list. */
export const nameFieldSchema = profileTextField(100);

/** Public display name (e.g. "Alex", "Jo's Kitchen"). IS profanity-checked —
 * it's user-written and shown to everyone. */
export const displayNameFieldSchema = profileTextField(100).refine(
  (value) => !containsOffensiveContent(value),
  {
    message: "Display name contains language we do not allow",
  },
);

export const passwordSchema = safeString(128, 12)
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const tokenSchema = (name: string) =>
  z
    .string()
    .min(1, `${name} is required`)
    .max(100, `${name} is too long`)
    .regex(/^(?!.*\0)/, "Null bytes are not allowed");

export const refreshTokenSchema = z
  .string()
  .min(1, "Refresh token is required")
  .max(255, "Refresh token is too long")
  .regex(/^(?!.*\0)/, "Null bytes are not allowed");

export const okResponseSchema = z.object({
  message: z.string(),
});

export const userIdSchema = z.object({
  userId: z.uuid(),
});

export type UserIdType = z.infer<typeof userIdSchema>;

export const profileSnippetSchema = z.object({
  displayName: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  avatar: safeString(1024).nullish(),
  bio: z.string().nullish(),
});

export const profileCoreSchema = z.object({
  displayName: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  avatar: safeString(1024).nullish(),
});

export const userSummarySchema = z.object({
  id: z.uuid(),
  username: z.string(),
  profile: profileSnippetSchema.nullish(),
});

export type UserSummaryType = z.infer<typeof userSummarySchema>;

export const uuidParam = (name: string) => z.object({ [name]: z.uuid() });

export const arrayResponseSchema = <T extends z.ZodTypeAny>(
  name: string,
  items: T,
) => z.object({ [name]: z.array(items) });

export const singleItemResponseSchema = <T extends z.ZodTypeAny>(
  name: string,
  item: T,
) => z.object({ [name]: item });

export const MessageType = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  FILE: "FILE",
  STICKER: "STICKER",
  LOCATION: "LOCATION",
  CONTACT: "CONTACT",
  CALL: "CALL",
  SYSTEM: "SYSTEM",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const messageTypeSchema = z.enum([
  "TEXT",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "FILE",
  "STICKER",
  "LOCATION",
  "CONTACT",
  "CALL",
  "SYSTEM",
]);
