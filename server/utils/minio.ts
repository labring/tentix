import { S3Error } from "@/api/middleware.ts";
import { S3Client } from "bun";


const bucket = new S3Client({
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY,
  bucket: process.env.MINIO_BUCKET,
  endpoint: process.env.MINIO_ENDPOINT,
});

export async function getPresignedUrl(fileName: string, fileType: string): Promise<{ url: string; fileName: string }> {
  try {
    const newFileName = `${new Date().toJSON().split('T')[0]}/${Math.random().toString(36).slice(-6)}-${fileName}`;
    const uploadUrl = bucket.presign(newFileName, {
      expiresIn: 3600, // 1 hour
      method: "PUT",
      acl: "public-read",
      type: fileType, // No extension for inferring, so we can specify the content type to be JSON
    });
    return {
      url: uploadUrl,
      fileName: newFileName,
    };
  } catch (error) {
    throw new S3Error("Error getting presigned url", error as Error);
  }
}

export async function removeFile(fileName: string) {
  try {
    await bucket.delete(fileName);
  } catch (error) {
    throw new S3Error("Error removing file", error as Error);
  }
}