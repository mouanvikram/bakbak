import { randomUUID } from "node:crypto";
import type { UploadFile } from "@bakbak/contracts";

interface PendingAvatar {
	file: UploadFile;
	createdAt: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PENDING = 1000;

/**
 * In-memory store for avatar files uploaded before signup completes.
 *
 * The file buffer is held here keyed by an avatarToken, and only written to
 * object storage + the database when signup actually completes. Entries are
 * purged after TTL_MS or when a signup consumes them, preventing unbounded
 * memory growth from abandoned signups.
 */
export class AvatarTokenStore {
	private readonly pending = new Map<string, PendingAvatar>();

	put(file: UploadFile): { avatarToken: string } {
		this.purgeExpired();

		const avatarToken = randomUUID();
		this.pending.set(avatarToken, {
			file: {
				fieldname: file.fieldname,
				originalname: file.originalname,
				encoding: file.encoding,
				mimetype: file.mimetype,
				buffer: Buffer.from(file.buffer),
				size: file.size,
			},
			createdAt: Date.now(),
		});

		if (this.pending.size > MAX_PENDING) {
			this.purgeExpired(true);
		}

		return { avatarToken };
	}

	/** Retrieves the pending file for a token and, when found, removes it. */
	consume(avatarToken: string): UploadFile | null {
		this.purgeExpired();

		const entry = this.pending.get(avatarToken);
		if (!entry) return null;

		this.pending.delete(avatarToken);
		return entry.file;
	}

	private purgeExpired(force = false) {
		const cutoff = Date.now() - TTL_MS;
		for (const [token, entry] of this.pending) {
			if (entry.createdAt < cutoff) {
				this.pending.delete(token);
			}
		}

		if (force) {
			let overflow = this.pending.size - MAX_PENDING;
			for (const [token] of this.pending) {
				if (overflow <= 0) break;
				this.pending.delete(token);
				overflow--;
			}
		}
	}
}

export const avatarTokenStore = new AvatarTokenStore();
