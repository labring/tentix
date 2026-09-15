// 2. 发送时处理文件上传的工具函数

import { type JSONContentZod } from "tentix-server/types";
import { waitForSealosAuthReady } from "../../_provider/sealos";
import {
  getAttachmentMaxSize,
  isGenericAttachmentMimeType,
} from "tentix-ui";

// 错误处理工具函数
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown error occurred";
};

// 上传错误类型
class UploadError extends Error {
  constructor(
    message: string,
    public readonly fileName?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

const VIDEO_FILE_SIZE_LIMIT = 52_428_800;
const VIDEO_CHECK_NO_PROGRESS_TIMEOUT = 60_000;

export type UploadPhase = "uploading" | "checking";

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  currentFile?: string;
  phase: UploadPhase;
}

export interface UploadedFile {
  id: string;
  url: string;
  fileName: string;
}

export interface UploadResult {
  processedContent: JSONContentZod;
  uploadedFiles: UploadedFile[];
}

// 上传单个文件
const uploadFile = async (
  file: File,
  onProgress: (loaded: number, phase: UploadPhase) => void,
): Promise<{ url: string; fileName: string }> => {
  try {
    if (file.type === "video/mp4" && file.size > VIDEO_FILE_SIZE_LIMIT) {
      throw new UploadError("Video file must not exceed 50 MB", file.name);
    }
    if (isGenericAttachmentMimeType(file.type) && file.size > getAttachmentMaxSize(file.type)) {
      throw new UploadError(
        file.type === "application/zip" || file.type === "application/x-zip-compressed"
          ? "ZIP file must not exceed 50 MB"
          : "Attachment file must not exceed 25 MB",
        file.name,
      );
    }
    const presignedUrl = new URL(
      "/api/file/presigned-url",
      window.location.origin,
    );
    presignedUrl.searchParams.set("fileName", file.name);
    presignedUrl.searchParams.set("fileType", file.type);
    presignedUrl.searchParams.set("fileSize", String(file.size));

    await waitForSealosAuthReady(presignedUrl.toString());

    const token = window.localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const presignedResponse = await fetch(presignedUrl, { headers });

    if (!presignedResponse.ok) {
      if (presignedResponse.status === 429) {
        throw new UploadError(
          "Too many upload requests. Please wait a moment and try again.",
          file.name,
        );
      }
      if (presignedResponse.status === 401) {
        throw new UploadError(
          "Please log in again to upload files.",
          file.name,
        );
      }
      throw new UploadError(
        `Failed to get upload URL: ${presignedResponse.status}`,
        file.name,
      );
    }

    const { url, srcUrl, fileName } = await presignedResponse.json();

    await putFileWithProgress(url, file, (loaded) =>
      onProgress(loaded, "uploading"),
    );

    return { url: srcUrl, fileName };
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }
    throw new UploadError(
      `Failed to upload ${file.name}: ${getErrorMessage(error)}`,
      file.name,
      error,
    );
  }
};

const putFileWithProgress = (
  url: string,
  file: File,
  onProgress: (loaded: number) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(
            new UploadError("Failed to upload file to storage", file.name),
          );
    request.onerror = () =>
      reject(new UploadError("Failed to upload file to storage", file.name));
    request.onabort = () =>
      reject(new UploadError("Upload was interrupted", file.name));
    request.send(file);
  });

const verifyUploadedVideo = async (
  srcUrl: string,
  fileName: string,
  file: File,
): Promise<void> => {
  const verifyUrl = new URL("/api/file/verify", window.location.origin);
  verifyUrl.searchParams.set("fileName", fileName);
  verifyUrl.searchParams.set("fileType", "video/mp4");
  verifyUrl.searchParams.set("fileSize", String(file.size));
  const token = window.localStorage.getItem("token");
  const headers: HeadersInit = token
    ? { Authorization: "Bearer " + token }
    : {};
  const response = await fetch(verifyUrl, { headers });
  if (!response.ok) {
    throw new UploadError(
      "Video could not be used. Please upload it again.",
      file.name,
    );
  }
  await waitForPlayableVideo(srcUrl, file.name);
};

const verifyUploadedGenericFile = async (
  storageFileName: string,
  file: File,
): Promise<void> => {
  const verifyUrl = new URL("/api/file/verify", window.location.origin);
  verifyUrl.searchParams.set("fileName", storageFileName);
  verifyUrl.searchParams.set("originalFileName", file.name);
  verifyUrl.searchParams.set("fileType", file.type);
  verifyUrl.searchParams.set("fileSize", String(file.size));
  const token = window.localStorage.getItem("token");
  const response = await fetch(verifyUrl, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const isLogContentError =
      file.name.toLowerCase().endsWith(".log") &&
      response.status === 422 &&
      body?.message === "Uploaded attachment content is invalid";
    const message =
      isLogContentError
        ? "日志文件需要使用 UTF-8 编码，请转换后重试"
        : typeof body?.message === "string"
        ? body.message
        : response.status === 503
          ? "File verification is temporarily unavailable"
          : "File content does not match its declared format";
    throw new UploadError(
      message,
      file.name,
    );
  }
};

const waitForPlayableVideo = (srcUrl: string, fileName: string) =>
  new Promise<void>((resolve, reject) => {
    const video = document.createElement("video");
    let noProgressTimer: number | undefined;
    const finish = (error?: Error) => {
      if (noProgressTimer !== undefined) {
        window.clearTimeout(noProgressTimer);
      }
      video.removeAttribute("src");
      video.load();
      error ? reject(error) : resolve();
    };
    const resetNoProgressTimer = () => {
      if (noProgressTimer !== undefined) {
        window.clearTimeout(noProgressTimer);
      }
      noProgressTimer = window.setTimeout(
        () =>
          finish(
            new UploadError(
              "Video check timed out. Please upload it again.",
              fileName,
            ),
          ),
        VIDEO_CHECK_NO_PROGRESS_TIMEOUT,
      );
    };
    video.preload = "auto";
    video.onloadstart = resetNoProgressTimer;
    video.onprogress = resetNoProgressTimer;
    video.onstalled = resetNoProgressTimer;
    video.onwaiting = resetNoProgressTimer;
    video.oncanplay = () => finish();
    video.onerror = () =>
      finish(
        new UploadError(
          "Video could not be played. Please upload it again.",
          fileName,
        ),
      );
    resetNoProgressTimer();
    video.src = srcUrl;
    video.load();
  });

export const removeUploadedFiles = async (
  files: UploadedFile[],
): Promise<void> => {
  const token = window.localStorage.getItem("token");
  const headers: HeadersInit = token
    ? { Authorization: "Bearer " + token }
    : {};
  await Promise.allSettled(
    files.map((file) => {
      const removeUrl = new URL("/api/file/remove", window.location.origin);
      removeUrl.searchParams.set("fileName", file.fileName);
      return fetch(removeUrl, { method: "DELETE", headers });
    }),
  );
};

// 文件信息接口
interface FileToUpload {
  id: string;
  file: File;
  blobUrl: string;
}

// 从编辑器内容中提取需要上传的文件
const extractFilesToUpload = (content: JSONContentZod): FileToUpload[] => {
  const filesToUpload: FileToUpload[] = [];

  const traverse = (node: any): void => {
    if (
      (node.type === "image" || node.type === "video" || node.type === "attachment") &&
      node.attrs?.isLocalFile &&
      node.attrs?.originalFile
    ) {
      filesToUpload.push({
        id: node.attrs.id,
        file: node.attrs.originalFile,
        blobUrl: node.attrs.src,
      });
    }

    if (node.content) {
      node.content.forEach(traverse);
    }
  };

  if (content.content) {
    content.content.forEach(traverse);
  }

  return filesToUpload;
};

// 内部使用的上传文件信息接口
interface UploadedFileInfo {
  id: string;
  url: string;
  fileName: string;
  blobUrl: string;
}

// 上传文件并更新内容中的 URL
export const processFilesAndUpload = async (
  content: JSONContentZod,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> => {
  const filesToUpload = extractFilesToUpload(content);

  if (filesToUpload.length === 0) {
    return {
      processedContent: content,
      uploadedFiles: [],
    };
  }

  const uploadedFiles: UploadedFileInfo[] = [];
  const totalBytes = filesToUpload.reduce(
    (total, item) => total + item.file.size,
    0,
  );
  const uploadedBytes = new Map<string, number>();
  const reportProgress = (
    id: string,
    file: File,
    loaded: number,
    phase: UploadPhase,
  ) => {
    uploadedBytes.set(id, loaded);
    onProgress?.({
      uploadedBytes: Array.from(uploadedBytes.values()).reduce(
        (total, value) => total + value,
        0,
      ),
      totalBytes,
      currentFile: file.name,
      phase,
    });
  };

  // 并发上传文件（限制并发数）
  const CONCURRENT_UPLOADS = 3;

  // 分批处理上传
  for (let i = 0; i < filesToUpload.length; i += CONCURRENT_UPLOADS) {
    const batch = filesToUpload.slice(i, i + CONCURRENT_UPLOADS);

    const batchPromises = batch.map(async ({ id, file, blobUrl }) => {
      try {
        reportProgress(id, file, 0, "uploading");

        const uploaded = await uploadFile(file, (loaded, phase) =>
          reportProgress(id, file, loaded, phase),
        );

        uploadedFiles.push({
          id,
          url: uploaded.url,
          fileName: uploaded.fileName,
          blobUrl,
        });

        if (file.type === "video/mp4") {
          reportProgress(id, file, file.size, "checking");
          await verifyUploadedVideo(uploaded.url, uploaded.fileName, file);
        } else if (isGenericAttachmentMimeType(file.type)) {
          reportProgress(id, file, file.size, "checking");
          await verifyUploadedGenericFile(uploaded.fileName, file);
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);

        // 使用安全的错误消息获取
        const errorMessage =
          error instanceof UploadError
            ? error.message
            : `Failed to upload ${file.name}: ${getErrorMessage(error)}`;

        throw new UploadError(errorMessage, file.name, error);
      }
    });

    // 等待当前批次完成
    const results = await Promise.allSettled(batchPromises);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) {
      await removeUploadedFiles(uploadedFiles);
      throw failed.reason;
    }
  }

  // 更新内容，替换 blob URL 为真实 URL
  const processedContent = updateContentUrls(content, uploadedFiles);

  // 清理 blob URL
  cleanupBlobUrls(
    filesToUpload.filter(({ file }) => !file.type.startsWith("video/")),
  );

  return {
    processedContent,
    uploadedFiles: uploadedFiles.map(({ id, url, fileName }) => ({
      id,
      url,
      fileName,
    })),
  };
};

// 清理 blob URL
const cleanupBlobUrls = (filesToUpload: FileToUpload[]): void => {
  // 在 ImageViewBlock 将 blob 转为 base64 时已经清理了 blob URL， src 实际已经被换成 base64
  // 这里是防御性编程
  filesToUpload.forEach(({ blobUrl }) => {
    if (blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.warn("Failed to revoke blob URL:", blobUrl, error);
      }
    }
  });
};

// 更新内容中的图片 URL
const updateContentUrls = (
  content: JSONContentZod,
  uploadedFiles: UploadedFileInfo[],
): JSONContentZod => {
  const urlMap = new Map(
    uploadedFiles.map(({ id, url, fileName }) => [id, { url, fileName }]),
  );

  const traverse = (node: any): any => {
    if (
      (node.type === "image" || node.type === "video" || node.type === "attachment") &&
      node.attrs?.isLocalFile &&
      urlMap.has(node.attrs.id)
    ) {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          src: urlMap.get(node.attrs.id)?.url, // 替换为真实 URL
          ...(node.type === "video" || node.type === "attachment"
            ? { storageFileName: urlMap.get(node.attrs.id)?.fileName }
            : {}),
          ...(node.type === "attachment"
            ? { mimeType: node.attrs.mimeType, fileSize: node.attrs.fileSize }
            : {}),
          isLocalFile: false, // 标记为已上传
          originalFile: node.type === "video" || node.type === "attachment" ? null : undefined,
        },
      };
    }

    if (node.content) {
      return {
        ...node,
        content: node.content.map(traverse),
      };
    }

    return node;
  };

  return {
    ...content,
    content: content.content?.map(traverse) || [],
  };
};
