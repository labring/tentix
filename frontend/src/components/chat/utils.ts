export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return fallback;
};

// 检查 TipTap 内容节点是否有实际内容 - 支持所有TipTap节点类型
export const hasNodeContent = (
  node: { type?: string; content?: unknown[]; text?: string } | unknown,
): boolean => {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; content?: unknown[]; text?: string };

  if (!n.type) return false;

  // 段落：检查是否有内容
  if (n.type === "paragraph" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 标题：有内容就算有效（支持h1-h6）
  if (n.type === "heading" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 列表：有列表项就算有效
  if (
    (n.type === "orderedList" || n.type === "bulletList") &&
    Array.isArray(n.content)
  ) {
    return n.content.length > 0;
  }

  // 列表项：有内容就算有效
  if (n.type === "listItem" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 引用块：有内容就算有效
  if (n.type === "blockquote" && Array.isArray(n.content)) {
    return n.content.length > 0;
  }

  // 代码块：直接算作有内容（即使空的也可以发送）
  if (n.type === "codeBlock") {
    return true;
  }

  // 水平线：直接算作有内容
  if (n.type === "horizontalRule") {
    return true;
  }

  // 图片和媒体文件：直接算作有内容
  if (n.type === "image") {
    return true;
  }

  // 硬换行：直接算作有内容
  if (n.type === "hardBreak") {
    return true;
  }

  // 文本节点：检查是否有文本内容
  if (n.type === "text" && n.text) {
    return n.text.trim().length > 0;
  }

  return false;
};

// 检查 TipTap 内容节点是否为本地文件
export const isLocalFileNode = (
  node: { type?: string; attrs?: { isLocalFile?: boolean } } | unknown,
): boolean => {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; attrs?: { isLocalFile?: boolean } };
  return n.type === "image" && n.attrs?.isLocalFile === true;
};
