import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient: S3Client | null = null;

export function getS3Client() {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: requiredEnv("AWS_REGION"),
      credentials: {
        accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY")
      }
    });
  }

  return cachedClient;
}

export async function uploadToS3(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}) {
  const bucket = requiredEnv("S3_BUCKET_NAME");

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType
    })
  );

  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return publicBase ? `${publicBase}/${params.key}` : `s3://${bucket}/${params.key}`;
}

export async function getDownloadUrl(key: string) {
  const bucket = requiredEnv("S3_BUCKET_NAME");
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (publicBase) {
    return `${publicBase}/${key}`;
  }

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }),
    { expiresIn: 60 * 10 }
  );
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}
