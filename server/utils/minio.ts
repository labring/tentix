/* eslint-disable drizzle/enforce-delete-with-where */
import { S3Error } from "@/api/middleware.ts";
import { S3Client } from "bun";
import { isGenericAttachmentMimeType } from "./file-constants.ts";

const bucket = new S3Client({
  accessKeyId: global.customEnv.MINIO_ACCESS_KEY,
  secretAccessKey: global.customEnv.MINIO_SECRET_KEY,
  bucket: global.customEnv.MINIO_BUCKET,
  endpoint: global.customEnv.MINIO_ENDPOINT,
});

export async function getPresignedUrl(fileName: string, fileType: string): Promise<{ url: string; fileName: string }> {
  try {
    // For videos, use an opaque random key; keep existing naming for other files
    const newFileName = fileType === "video/mp4" || isGenericAttachmentMimeType(fileType)
      ? crypto.randomUUID()
      : fileName.startsWith('avatar/') 
        ? fileName 
        : `${new Date().toJSON().split('T')[0]}/${Math.random().toString(36).slice(-6)}-${fileName}`;
    
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

export async function getFileStat(fileName: string) {
  try {
    const stat = await bucket.file(fileName).stat();
    return {
      size: stat.size,
      type: stat.type,
    };
  } catch (error) {
    throw new S3Error("Error checking file in storage", error as Error);
  }
}

export function getFileForDownload(fileName: string) {
  return bucket.file(fileName);
}
