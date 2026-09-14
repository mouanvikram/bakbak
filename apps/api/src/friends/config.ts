// Friends module config — cache lifetimes for the friends list and suggestions.
import { positiveNum } from "@/config/parse";

export const friendsConfig = {
  cache: {
    // Invalidated on every friendship change and on any friend's profile edit,
    // so this only bounds how long a missed invalidation (e.g. a write made
    // while Redis was reconnecting) can linger.
    listTtlSec: positiveNum(process.env.FRIENDS_LIST_CACHE_TTL_SEC, 300),
    // Short on purpose: suggestions also shift when anyone signs up or edits
    // their profile, and those changes aren't invalidated per viewer.
    suggestionsTtlSec: positiveNum(
      process.env.FRIEND_SUGGESTIONS_CACHE_TTL_SEC,
      60,
    ),
  },
};
