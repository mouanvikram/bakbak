import "./setup";
import { afterAll, beforeEach, describe, test, expect } from "bun:test";
import { randomUUID } from "node:crypto";
import { prisma } from "@bakbak/db";
import { uploadService } from "@/services/service.container";
import { storageProvider } from "@/uploads/storage";
import {
  cleanupDatabase,
  createTestUser,
  createTestDirectChat,
  createTestMessage,
  isDatabaseAvailable,
  isStorageAvailable,
} from "./helpers";

const DB_AVAILABLE = await isDatabaseAvailable();
const STORAGE_AVAILABLE = DB_AVAILABLE && (await isStorageAvailable());

const OLD = () => new Date(Date.now() - 60_000);
const CUTOFF = () => new Date(Date.now() - 1_000);

async function storeObject(key: string) {
  await storageProvider.upload(key, Buffer.from("x"), "image/png");
}

async function seedAttachment(opts: {
  ownerId?: string | null;
  filePath: string;
  messageId?: string | null;
  createdAt: Date;
}) {
  return prisma.attachment.create({
    data: {
      kind: "IMAGE",
      ownerId: opts.ownerId ?? null,
      fileName: "x.png",
      filePath: opts.filePath,
      mimeType: "image/png",
      fileSize: 1,
      messageId: opts.messageId ?? null,
      createdAt: opts.createdAt,
    },
  });
}

describe.skipIf(!DB_AVAILABLE)("Orphan attachment cleanup", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
  });

  test.skipIf(!STORAGE_AVAILABLE)(
    "deletes an unlinked upload older than the cutoff and its object",
    async () => {
      const user = await createTestUser();
      const key = `${user.id}/${randomUUID()}.png`;
      await storeObject(key);
      const row = await seedAttachment({
        ownerId: user.id,
        filePath: key,
        createdAt: OLD(),
      });

      const result = await uploadService.cleanupOrphans(CUTOFF());

      expect(result.deleted).toBe(1);
      expect(await prisma.attachment.findUnique({ where: { id: row.id } })).toBeNull();
      expect(await storageProvider.exists(key)).toBe(false);
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "keeps a fresh unlinked upload and an upload already linked to a message",
    async () => {
      const user = await createTestUser();
      const peer = await createTestUser();
      const freshKey = `${user.id}/${randomUUID()}.png`;
      const chat = await createTestDirectChat(user.id, peer.id);
      const message = await createTestMessage(chat.id, user.id);
      const linkedKey = `${user.id}/${randomUUID()}.png`;
      await storeObject(freshKey);
      await storeObject(linkedKey);

      const fresh = await seedAttachment({
        ownerId: user.id,
        filePath: freshKey,
        createdAt: new Date(),
      });
      const linked = await seedAttachment({
        ownerId: user.id,
        filePath: linkedKey,
        messageId: message.id,
        createdAt: OLD(),
      });

      const result = await uploadService.cleanupOrphans(CUTOFF());

      expect(result.deleted).toBe(0);
      expect(await prisma.attachment.findUnique({ where: { id: fresh.id } })).not.toBeNull();
      expect(await prisma.attachment.findUnique({ where: { id: linked.id } })).not.toBeNull();
      expect(await storageProvider.exists(freshKey)).toBe(true);
      expect(await storageProvider.exists(linkedKey)).toBe(true);
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "removes a replaced avatar's row but keeps the profile's current avatar",
    async () => {
      const liveKey = `avatars/${randomUUID()}.png`;
      const staleKey = `avatars/${randomUUID()}.png`;
      await createTestUser({ avatar: liveKey });
      await storeObject(liveKey);
      await storeObject(staleKey);

      const live = await seedAttachment({ filePath: liveKey, createdAt: OLD() });
      const stale = await seedAttachment({ filePath: staleKey, createdAt: OLD() });

      const result = await uploadService.cleanupOrphans(CUTOFF());

      expect(result.deleted).toBe(1);
      expect(await prisma.attachment.findUnique({ where: { id: live.id } })).not.toBeNull();
      expect(await prisma.attachment.findUnique({ where: { id: stale.id } })).toBeNull();
      expect(await storageProvider.exists(liveKey)).toBe(true);
      expect(await storageProvider.exists(staleKey)).toBe(false);
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "removes attachments of soft-deleted messages and keeps live ones",
    async () => {
      const user = await createTestUser();
      const peer = await createTestUser();
      const chat = await createTestDirectChat(user.id, peer.id);
      const deletedMessage = await createTestMessage(chat.id, user.id, {
        deleted: true,
      });
      const liveMessage = await createTestMessage(chat.id, user.id);

      const goneKey = `${user.id}/${randomUUID()}.png`;
      const keptKey = `${user.id}/${randomUUID()}.png`;
      await storeObject(goneKey);
      await storeObject(keptKey);

      const gone = await seedAttachment({
        ownerId: user.id,
        filePath: goneKey,
        messageId: deletedMessage.id,
        createdAt: OLD(),
      });
      const kept = await seedAttachment({
        ownerId: user.id,
        filePath: keptKey,
        messageId: liveMessage.id,
        createdAt: OLD(),
      });

      const result = await uploadService.cleanupOrphans(CUTOFF());

      expect(result.deleted).toBe(1);
      expect(await prisma.attachment.findUnique({ where: { id: gone.id } })).toBeNull();
      expect(await prisma.attachment.findUnique({ where: { id: kept.id } })).not.toBeNull();
      expect(await storageProvider.exists(goneKey)).toBe(false);
      expect(await storageProvider.exists(keptKey)).toBe(true);
    },
  );
});
