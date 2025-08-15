import { type JSONContentZod } from "../types";

/**
 * 提取JSONContent中的图片URL
 */
export function extractImageUrls(content: JSONContentZod): string[] {
  const images: string[] = [];
  
  function walk(node: JSONContentZod) {
    if (node.type === "image" && node.attrs?.src) {
      images.push(node.attrs.src);
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => walk(child));
    }
  }
  
  walk(content);
  return images;
}

/**
 * 创建纯文本版本（移除图片节点）
 */
export function extractTextWithoutImages(content: JSONContentZod): string {
  let out = "";
  let listCounter = 0;
  let inOrderedList = false;

  function walk(node: JSONContentZod, isInList = false) {
    switch (node.type) {
      case "text": {
        out += node.text || "";
        break;
      }
      case "paragraph": {
        node.content?.forEach(child => walk(child, isInList));
        if (!isInList) {
          out += "\n";
        }
        break;
      }
      case "heading": {
        const level = node.attrs?.level || 1;
        out += "#".repeat(level);
        out += " ";
        node.content?.forEach(child => walk(child));
        out += "\n";
        break;
      }
      case "hardBreak": {
        out += "\n";
        break;
      }
      case "bulletList": {
        inOrderedList = false;
        node.content?.forEach(child => walk(child));
        out += "\n";
        break;
      }
      case "orderedList": {
        inOrderedList = true;
        listCounter = node.attrs?.start || 1;
        node.content?.forEach(child => walk(child));
        out += "\n";
        break;
      }
      case "listItem": {
        if (inOrderedList) {
          out += `${listCounter}. `;
          listCounter++;
        } else {
          out += "- ";
        }
        node.content?.forEach(child => walk(child, true));
        out += "\n";
        break;
      }
      case "blockquote": {
        out += "> ";
        node.content?.forEach(child => walk(child));
        out += "\n";
        break;
      }
      case "codeBlock": {
        const language = node.attrs?.language || "";
        out += "\n```";
        out += language;
        out += "\n";
        node.content?.forEach(child => walk(child));
        out += "\n```\n";
        break;
      }
      case "horizontalRule": {
        out += "\n---\n";
        break;
      }
      case "image": {
        // 跳过图片节点，不输出任何内容
        break;
      }
      default: {
        node.content?.forEach(child => walk(child, isInList));
      }
    }
  }

  walk(content);
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 转换消息为多模态格式
 */
export function convertToMultimodalMessage(
  content: JSONContentZod
): string | Array<{type: "text", text: string} | {type: "image_url", image_url: {url: string}}> {
  const images = extractImageUrls(content);
  const textContent = extractTextWithoutImages(content);
  
  if (images.length === 0) {
    // 没有图片，返回纯文本
    return textContent;
  }
  
  // 有图片，构建多模态消息
  const messageContent: Array<{type: "text", text: string} | {type: "image_url", image_url: {url: string}}> = [];
  
  if (textContent.trim()) {
    messageContent.push({
      type: "text",
      text: textContent
    });
  }
  
  images.forEach(imageUrl => {
    messageContent.push({
      type: "image_url",
      image_url: {
        url: imageUrl
      }
    });
  });
  
  return messageContent;
}

/**
 * 获取包含图片信息的文本内容（用于知识库构建和索引）
 */
export function getTextWithImageInfo(content: JSONContentZod): string {
  const images = extractImageUrls(content);
  let text = extractTextWithoutImages(content);
  
  // 如果有图片，在文本末尾添加图片信息
  if (images.length > 0) {
    const imageInfo = images.map(url => `[图片: ${url}]`).join(" ");
    text = text ? `${text} ${imageInfo}` : imageInfo;
  }
  
  return text;
}