import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
} from "obscenity";

// One filter instance shared by the whole app (it's cheap to build and has no
// memory). Its "transformers" normalise sneaky variants before matching:
//   "a$$"     -> decoded as "ass"   (leetspeak)
//   "ʃ𝐟ʃὗƈｋ" -> decoded as "fuck"  (lookalike letters)
//   "fuuuuck" -> decoded as "fuck"  (stretched letters)
const offensiveMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * Checks text for profanity, slurs, and abuse. The match is whole-word, so
 * innocent text is very rarely flagged.
 *
 * @example containsOffensiveContent("you suck") // true
 * @example containsOffensiveContent("a$$") // true (leetspeak)
 * @example containsOffensiveContent("bananas") // false
 * @example containsOffensiveContent("these grapes are yummy") // false
 */
export function containsOffensiveContent(value: string): boolean {
  return offensiveMatcher.hasMatch(value);
}

/**
 * Converts lookalike "compatibility" Unicode characters to their plain form
 * using NFKC, so text that *looks* the same is stored and compared the same.
 *
 * @example normalizeForStorage("ＡＢＣ") // "ABC" (fullwidth -> ASCII)
 * @example normalizeForStorage("ﬁle") // "file" (ligature split)
 * @example normalizeForStorage("e\u0301") // "é" (accent merged into one char)
 *
 * Pure ASCII passes straight through, and case is never changed ("Hello" stays
 * "Hello") — trim/lowercase separately where you need them.
 */
export function normalizeForStorage(value: string): string {
  return value.normalize("NFKC");
}

/**
 * Characters we never want in stored profile text. They are invisible or can
 * reorder what the reader sees, which is how hidden targetting/sneaky text
 * gets past a casual review.
 *
 * Blocked:
 *   - C0/C1 control chars: \u0000-\u0008, \u000b, \u000c, \u000e-\u001f, \u007f-\u009f
 *   - Unicode format chars (\p{Cf}): zero-width space \u200b, right-to-left
 *     override \u202e, the BOM \ufeff, variation selectors
 *
 * Allowed on purpose (so bios can wrap lines): tab \t, newline \n, carriage
 * return \r. Plain null bytes (\0) are already blocked earlier by `safeString`.
 */
export const DISALLOWED_CONTROL_CHARS_RE =
  // eslint-disable-next-line no-control-regex -- matching control chars is the point
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/u;