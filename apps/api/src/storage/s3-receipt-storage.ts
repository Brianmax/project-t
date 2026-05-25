import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ReceiptStorage } from './receipt-storage.interface';
import { assertProductionEndpointSafety } from './storage-safety';

@Injectable()
export class S3ReceiptStorage implements ReceiptStorage, OnModuleInit {
  private readonly logger = new Logger(S3ReceiptStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly defaultTtl: number;
  private readonly featureEnabled: boolean;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT');
    assertProductionEndpointSafety(endpoint, process.env.NODE_ENV);

    this.bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET');
    this.defaultTtl = Number(
      this.config.get<string>('STORAGE_URL_TTL_SECONDS') ?? '300',
    );
    this.featureEnabled =
      this.config.get<string>('RECEIPT_PDF_ENABLED') === 'true';

    this.client = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'us-east-1',
      endpoint,
      forcePathStyle: !!endpoint,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.featureEnabled) return;
    await this.ensureBucketExists();
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getDownloadUrl(
    key: string,
    opts?: { expiresInSec?: number; filename?: string },
  ): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: opts?.filename
        ? `attachment; filename="${opts.filename}"`
        : undefined,
    });
    return getSignedUrl(this.client, cmd, {
      expiresIn: opts?.expiresInSec ?? this.defaultTtl,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err) {
      if (this.isNotFound(err)) return false;
      throw err;
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (this.isNotFound(err)) {
        this.logger.log(`Bucket "${this.bucket}" not found — creating`);
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        return;
      }
      throw err;
    }
  }

  private isNotFound(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404;
  }
}
