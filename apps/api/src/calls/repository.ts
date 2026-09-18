import { prisma } from "@bakbak/db";

export interface CallPeerRow {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface CallRow {
  id: string;
  chatId: string;
  callerId: string;
  calleeId: string;
  type: "AUDIO" | "VIDEO";
  status: "RINGING" | "ANSWERED" | "MISSED" | "DECLINED" | "FAILED";
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  caller: CallPeerRow;
  callee: CallPeerRow;
}

// Both sides of every row are needed to render a history entry, and the
// caller/callee shape is identical, so select it once.
const peerSelect = {
  select: {
    id: true,
    username: true,
    profile: { select: { displayName: true, avatar: true } },
  },
} as const;

type RawPeer = {
  id: string;
  username: string;
  profile: { displayName: string | null; avatar: string | null } | null;
};

function toPeer(row: RawPeer): CallPeerRow {
  return {
    id: row.id,
    username: row.username,
    displayName: row.profile?.displayName ?? null,
    avatar: row.profile?.avatar ?? null,
  };
}

export class CallsRepository {
  /** The other active participant of a direct chat, or null if there isn't
   * exactly one (group chat, or the other side already left). */
  async findDirectCallee(
    chatId: string,
    callerId: string,
  ): Promise<string | null> {
    const others = await prisma.chatParticipant.findMany({
      where: { chatId, leftAt: null, userId: { not: callerId } },
      select: { userId: true },
      take: 2,
    });
    return others.length === 1 ? others[0]!.userId : null;
  }

  async createRinging(data: {
    chatId: string;
    callerId: string;
    calleeId: string;
    type: "AUDIO" | "VIDEO";
  }): Promise<{ id: string }> {
    return await prisma.call.create({
      data: { ...data, status: "RINGING" },
      select: { id: true },
    });
  }

  /** The live call for a chat, if one is still ringing or connected. Used to
   * attach an answer/end to the right row without trusting a client id. */
  async findLive(chatId: string): Promise<CallRow | null> {
    const call = await prisma.call.findFirst({
      where: { chatId, status: { in: ["RINGING", "ANSWERED"] }, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { caller: peerSelect, callee: peerSelect },
    });
    if (!call) return null;
    return {
      ...call,
      caller: toPeer(call.caller),
      callee: toPeer(call.callee),
    };
  }

  async markAnswered(id: string, at: Date = new Date()): Promise<void> {
    await prisma.call.updateMany({
      // Only a still-ringing row: a duplicate answer must not move the clock.
      where: { id, status: "RINGING" },
      data: { status: "ANSWERED", answeredAt: at },
    });
  }

  async markEnded(
    id: string,
    status: "ANSWERED" | "MISSED" | "DECLINED" | "FAILED",
    at: Date = new Date(),
  ): Promise<void> {
    await prisma.call.updateMany({
      where: { id, endedAt: null },
      data: { status, endedAt: at },
    });
  }

  /** Everything `userId` took part in, newest first, either direction. */
  async findHistoryFor(userId: string, limit: number): Promise<CallRow[]> {
    const calls = await prisma.call.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { caller: peerSelect, callee: peerSelect },
    });
    return calls.map((call) => ({
      ...call,
      caller: toPeer(call.caller),
      callee: toPeer(call.callee),
    }));
  }
}
