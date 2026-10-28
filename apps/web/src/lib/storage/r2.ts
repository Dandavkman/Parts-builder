import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertDownloadable, type ObjectStorage } from "./types";

type Env = Record<string, string | undefined>;

/** The R2 settings, or null when any is missing. Read at request time, never at build time. */
export function r2Config(env: Env = process.env) {
  const { R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = env;
  return accountId && accessKeyId && secretAccessKey && bucket ? { accountId, accessKeyId, secretAccessKey, bucket } : null;
}

export function r2Storage(config: NonNullable<ReturnType<typeof r2Config>>): ObjectStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;
  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return out.Body ? await out.Body.transformToByteArray() : null;
      } catch (error) {
        if ((error as { name?: string }).name === "NoSuchKey") return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    presignPut: (key, contentType, expiresSeconds) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), { expiresIn: expiresSeconds }),
    presignGet(key, expiresSeconds) {
      assertDownloadable(key);
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: expiresSeconds });
    },
  };
}

/** The shared storage, or null when R2 is not configured (callers answer 503). */
export function getStorage(env: Env = process.env): ObjectStorage | null {
  const config = r2Config(env);
  return config ? r2Storage(config) : null;
}
