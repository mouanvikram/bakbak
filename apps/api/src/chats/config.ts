// Chats module config — group size caps.
export const chatsConfig = {
  group: {
    // Hard upper bound on a group's roster, enforced on every add so it can't
    // grow unboundedly over time.
    maxParticipants: 1000,
    // Lower at creation: the whole roster arrives in one JSON body, which the
    // body-size limit caps well below the 1000 a group can reach by adding
    // people afterwards.
    createMaxParticipants: 780,
  },
};
