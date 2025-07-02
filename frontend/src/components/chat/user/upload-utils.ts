// 2. 发送时处理文件上传的工具函数

import { type JSONContentZod } from "tentix-server/types";

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

// 上传单个文件
const uploadFile = async (file: File): Promise<string> => {
  try {
    const presignedUrl = new URL(
      "/api/file/presigned-url",
      window.location.origin,
    );
    presignedUrl.searchParams.set("fileName", file.name);
    presignedUrl.searchParams.set("fileType", file.type);

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

    const { url, srcUrl } = await presignedResponse.json();

    const response = await fetch(url, {
      method: "PUT",
      body: file,
    });

    if (!response.ok) {
      throw new UploadError("Failed to upload file to storage", file.name);
    }

    return srcUrl;
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
      node.type === "image" &&
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

// 上传进度信息接口
interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

// 上传结果接口
interface UploadResult {
  processedContent: JSONContentZod;
  uploadedFiles: Array<{ id: string; url: string }>;
}

// 内部使用的上传文件信息接口
interface UploadedFileInfo {
  id: string;
  url: string;
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
  let uploadedCount = 0;

  // 并发上传文件（限制并发数）
  const CONCURRENT_UPLOADS = 3;

  // 分批处理上传
  for (let i = 0; i < filesToUpload.length; i += CONCURRENT_UPLOADS) {
    const batch = filesToUpload.slice(i, i + CONCURRENT_UPLOADS);

    const batchPromises = batch.map(async ({ id, file, blobUrl }) => {
      try {
        onProgress?.({
          uploaded: uploadedCount,
          total: filesToUpload.length,
          currentFile: file.name,
        });

        const uploadedUrl = await uploadFile(file);

        uploadedFiles.push({
          id,
          url: uploadedUrl,
          blobUrl,
        });

        uploadedCount++;

        onProgress?.({
          uploaded: uploadedCount,
          total: filesToUpload.length,
        });
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
    await Promise.all(batchPromises);
  }

  // 更新内容，替换 blob URL 为真实 URL
  const processedContent = updateContentUrls(content, uploadedFiles);

  // 清理 blob URL
  cleanupBlobUrls(filesToUpload);

  return {
    processedContent,
    uploadedFiles: uploadedFiles.map(({ id, url }) => ({ id, url })),
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
  const urlMap = new Map(uploadedFiles.map((f) => [f.id, f.url]));

  const traverse = (node: any): any => {
    if (
      node.type === "image" &&
      node.attrs?.isLocalFile &&
      urlMap.has(node.attrs.id)
    ) {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          src: urlMap.get(node.attrs.id), // 替换为真实 URL
          isLocalFile: false, // 标记为已上传
          originalFile: undefined, // 清除原始文件引用
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
