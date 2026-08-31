import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./storage.provider";

/**
 * S3-compatible storage adapter (works for both MinIO and Amazon S3, since
 * MinIO implements the S3 API). The endpoint/credentials come from env vars,
 * so switching between MinIO and AWS S3 is purely a configuration change.
 */
export class S3StorageProvider implements StorageProvider {
	private readonly client: S3Client;
	private readonly bucket: string;
	/** Optional public base URL for objects (e.g. a CDN); null disables it. */
	private readonly publicUrl: string | null;

	constructor(
		options: {
			endpoint: string;
			port: number;
			useSsl: boolean;
			region: string;
			accessKeyId: string;
			secretAccessKey: string;
			bucket: string;
			publicUrl?: string;
		},
		private readonly defaultExpiresInSeconds = 3600,
	) {
		this.bucket = options.bucket;
		this.publicUrl = options.publicUrl?.trim() || null;

		const protocol = options.useSsl ? "https" : "http";
		const endpoint = `${protocol}://${options.endpoint}:${options.port}`;

		this.client = new S3Client({
			region: options.region,
			endpoint,
			forcePathStyle: true,
			credentials: {
				accessKeyId: options.accessKeyId,
				secretAccessKey: options.secretAccessKey,
			},
		});
	}

	async upload(key: string, buffer: Buffer, contentType: string) {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			}),
		);
	}

	async getSignedUrl(key: string, expiresInSeconds = this.defaultExpiresInSeconds) {
		if (this.publicUrl) {
			return `${this.publicUrl.replace(/\/+$/, "")}/${key}`;
		}

		return await getSignedUrl(
			this.client,
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: key,
			}),
			{ expiresIn: expiresInSeconds },
		);
	}

	async delete(key: string) {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key,
			}),
		);
	}

	async exists(key: string) {
		try {
			await this.client.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
			return true;
		} catch {
			return false;
		}
	}
}
