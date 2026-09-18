import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./storage.provider";

/**
 * S3-compatible storage adapter (SeaweedFS, Amazon S3, ...). The
 * endpoint/credentials come from env vars, so switching backends is purely a
 * configuration change.
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
      // Presigned URLs must carry only params SeaweedFS re-canonicalizes when
      // verifying signatures. On the default `WHEN_SUPPORTED`, the SDK appends
      // `x-amz-checksum-mode=ENABLED` / `x-amz-checksum-*` to the query, which
      // SeaweedFS drops while re-signing — every presigned GET would fail with
      // SignatureDoesNotMatch. `WHEN_REQUIRED` on both keeps the query clean.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  // Connectivity probe for the `/readyz` readiness check. Self-bootstraps the
  // bucket so a fresh store only needs the credentials provisioned, never a
  // pre-created bucket (idempotent no-op once it exists).
  async ping(): Promise<boolean> {
    try {
      await this.ensureBucket();
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  // Create the bucket on demand if it is missing. Some S3-compatible gateways
  // do not auto-create objects' buckets, so an upload without this would fail
  // with a 403 NoSuchBucket against a fresh store.
  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (createError) {
        if (!isBucketExistsError(createError)) throw createError;
      }
    }
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = this.defaultExpiresInSeconds,
  ) {
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

// A concurrent create (or one allocating a bucket the store already owns) is a
// benign race, not a failure.
function isBucketExistsError(error: unknown): boolean {
  if (
    error instanceof Error &&
    (error.name === "BucketAlreadyOwnedByYou" ||
      error.name === "BucketAlreadyExists")
  ) {
    return true;
  }
  // AWS SDK errors carry `$metadata.httpStatusCode` (e.g. 409 Conflict).
  const sdkError = error as { $metadata?: { httpStatusCode?: number } } | null;
  return sdkError?.$metadata?.httpStatusCode === 409;
}
