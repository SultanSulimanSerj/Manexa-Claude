import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'

function getMinioEndpoint(): string {
  const raw = process.env.MINIO_ENDPOINT
  if (raw?.startsWith('http://') || raw?.startsWith('https://')) {
    return raw
  }
  const host = raw || 'localhost'
  const port = process.env.MINIO_PORT || '9000'
  const ssl = process.env.MINIO_USE_SSL === 'true'
  return `${ssl ? 'https' : 'http'}://${host}:${port}`
}

function getMinioCredentials() {
  return {
    accessKeyId:
      process.env.MINIO_ACCESS_KEY ||
      process.env.MINIO_ROOT_USER ||
      'minioadmin',
    secretAccessKey:
      process.env.MINIO_SECRET_KEY ||
      process.env.MINIO_ROOT_PASSWORD ||
      'changeme_local_dev',
  }
}

const s3Client = new S3Client({
  endpoint: getMinioEndpoint(),
  region: 'us-east-1',
  credentials: getMinioCredentials(),
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.MINIO_BUCKET || 'manexa-documents'

let bucketInitPromise: Promise<void> | null = null

async function ensureBucketExists(): Promise<void> {
  try {
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: BUCKET_NAME,
      })
    )
  } catch (error: unknown) {
    const err = error as { name?: string }
    if (
      err.name !== 'BucketAlreadyOwnedByYou' &&
      err.name !== 'BucketAlreadyExists'
    ) {
      throw error
    }
  }
}

async function ensureStorageReady(): Promise<void> {
  if (!bucketInitPromise) {
    bucketInitPromise = ensureBucketExists().catch((err) => {
      bucketInitPromise = null
      throw err
    })
  }
  await bucketInitPromise
}

export async function uploadFile(
  filePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await ensureStorageReady()
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filePath,
    Body: buffer,
    ContentType: mimeType,
  })

  await s3Client.send(command)
  return `${getMinioEndpoint()}/${BUCKET_NAME}/${filePath}`
}

export async function deleteFile(filePath: string): Promise<void> {
  await ensureStorageReady()
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    })
  )
}

export async function getFileBuffer(filePath: string): Promise<Buffer> {
  await ensureStorageReady()
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    })
  )
  const body = response.Body
  if (!body) {
    throw new Error(`Файл не найден: ${filePath}`)
  }
  const bytes = await body.transformToByteArray()
  const buffer = Buffer.from(bytes)
  if (buffer.length === 0) {
    throw new Error(`Файл в хранилище пустой: ${filePath}`)
  }
  return buffer
}

export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  await ensureStorageReady()
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filePath,
  })

  return awsGetSignedUrl(s3Client, command, { expiresIn })
}

export function getPublicUrl(filePath: string): string {
  return `${getMinioEndpoint()}/${BUCKET_NAME}/${filePath}`
}

export const storage = {
  uploadFile,
  deleteFile,
  getSignedUrl,
  getPublicUrl,
}
