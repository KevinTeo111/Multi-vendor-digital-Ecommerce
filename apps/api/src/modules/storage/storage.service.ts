import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { env } from '../../config/env';

export interface StoredObjectInfo {
  sizeBytes: number;
  contentType: string | undefined;
  etag: string | undefined;
}

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const MEDIA_URL_TTL_SECONDS = 60 * 60;

/**
 * S3-compatible object storage (Cloudflare R2, Amazon S3, MinIO).
 * The bucket is private; every read goes through a short-lived signed URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket = env.S3_BUCKET;

  constructor() {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }

  // ---- Key helpers -------------------------------------------------------

  productFileKey(vendorId: string, productId: string, fileName: string) {
    return `vendors/${vendorId}/products/${productId}/files/${randomUUID()}-${this.safeName(fileName)}`;
  }

  productImageKey(vendorId: string, productId: string, fileName: string) {
    const ext = extname(fileName).toLowerCase() || '.bin';
    return `vendors/${vendorId}/products/${productId}/images/${randomUUID()}${ext}`;
  }

  vendorLogoKey(vendorId: string, fileName: string) {
    const ext = extname(fileName).toLowerCase() || '.bin';
    return `vendors/${vendorId}/logo/${randomUUID()}${ext}`;
  }

  // ---- Signed URLs -------------------------------------------------------

  /** Presigned PUT for direct browser upload. The caller must confirm the upload afterwards. */
  async createUploadUrl(key: string, contentType: string) {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return { uploadUrl: url, storageKey: key, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  /** Presigned GET that forces a download with the original file name. */
  createDownloadUrl(key: string, fileName: string, ttlSeconds = env.DOWNLOAD_URL_TTL_SECONDS) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${this.safeName(fileName)}"`,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  /** Presigned GET for inline media (thumbnails, previews, logos). */
  createMediaUrl(key: string | null | undefined) {
    if (!key) return Promise.resolve(null);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: MEDIA_URL_TTL_SECONDS,
    });
  }

  /** Replaces `thumbnailKey` with a signed `thumbnailUrl` on any record that carries one. */
  async withThumbnail<T extends { thumbnailKey: string | null }>(
    item: T,
  ): Promise<Omit<T, 'thumbnailKey'> & { thumbnailUrl: string | null }> {
    const { thumbnailKey, ...rest } = item;
    return { ...rest, thumbnailUrl: await this.createMediaUrl(thumbnailKey) };
  }

  withThumbnails<T extends { thumbnailKey: string | null }>(items: T[]) {
    return Promise.all(items.map((i) => this.withThumbnail(i)));
  }

  /** Same as withThumbnail but keeps the key and also signs preview images (vendor/admin views). */
  async withProductMedia<T extends { thumbnailKey: string | null; previewImageKeys: string[] }>(
    product: T,
  ) {
    return {
      ...product,
      thumbnailUrl: await this.createMediaUrl(product.thumbnailKey),
      previewImageUrls: await Promise.all(
        product.previewImageKeys.map((k) => this.createMediaUrl(k)),
      ),
    };
  }

  // ---- Object operations -------------------------------------------------

  async headObject(key: string): Promise<StoredObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType, etag: res.ETag };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw err;
    }
  }

  /** Server-side upload; used by seed scripts and admin tooling, never by browser uploads. */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      // Orphaned objects are harmless; log and move on so DB state stays consistent.
      this.logger.warn(`Failed to delete object ${key}: ${(err as Error).message}`);
    }
  }

  private safeName(fileName: string) {
    return fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'file';
  }
}
