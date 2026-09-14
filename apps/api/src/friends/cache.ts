import logger from "@/lib/logger";
import { invalidate } from "@/redis/cache";
import { FriendRepository } from "./repository";

// Cached friends data holds raw avatar keys, never signed URLs: those expire,
// so services mint them per response after reading from the cache.
export const friendsCacheKeys = {
  list: (userId: string) => `friends:list:${userId}`,
  suggestions: (userId: string) => `friends:suggestions:${userId}`,
};

const friendRepository = new FriendRepository();

/** A friendship was created or removed between these users. */
export async function invalidateFriendship(...userIds: string[]) {
  await Promise.all(
    userIds.flatMap((id) => [
      invalidate(friendsCacheKeys.list(id)),
      invalidate(friendsCacheKeys.suggestions(id)),
    ]),
  );
}

/** A pending request between these users changed; only suggestions read it. */
export async function invalidateSuggestions(...userIds: string[]) {
  await Promise.all(
    userIds.map((id) => invalidate(friendsCacheKeys.suggestions(id))),
  );
}

/**
 * Something every friend's list shows about `userId` changed: their name,
 * username, bio or avatar, or the account was deleted or restored. Best
 * effort — the write it follows has already succeeded, so a failure here is
 * logged, never thrown.
 */
export async function invalidateFriendsOf(userId: string) {
  try {
    const friendIds = await friendRepository.findFriendIds(userId);
    await Promise.all(
      friendIds.map((id) => invalidate(friendsCacheKeys.list(id))),
    );
  } catch (error) {
    logger.warn(
      { err: error, userId },
      "Couldn't invalidate friends' cached lists",
    );
  }
}
