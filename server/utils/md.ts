import markdownit from "markdown-it";
import type { Token } from "markdown-it/index.js";
import type { JSONContent } from "@tiptap/core";

// TODO: 非 markdown 格式文本处理还是不够好，需要优化，后端非markdown格式应该存储字符串，前端添加对字符串的渲染处理，前端识别是否是markdown 格式，如果是则进行渲染，否则直接显示字符串。
/**
 * 智能转换文本为 TipTap JSONContent 格式
 * 1. 如果是 Markdown 格式，按 Markdown 解析
 * 2. 如果是普通文本，保持原样转换（保留缩进、换行）
 */
function textToTipTapJSON(text: string): JSONContent {
  // 检测是否包含 Markdown 标记
  if (isMarkdown(text)) {
    return markdownToTipTapJSON(text);
  } else {
    return plainTextToTipTapJSON(text);
  }
}

/**
 * 检测是否是 Markdown 格式
 */
function isMarkdown(text: string): boolean {
  const patterns = [
    /^#{1,6}\s/m, // 标题 # ## ###
    /^\s*[-*+]\s/m, // 无序列表
    /^\s*\d+\.\s/m, // 有序列表 1. 2.
    /```/, // 代码块
    /\*\*.*?\*\*/, // 粗体 **text**
    /\[.*?\]\(.*?\)/, // 链接 [text](url)
    /^>\s/m, // 引用 >
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * 将普通文本转换为 TipTap JSON（保持原样）
 */
function plainTextToTipTapJSON(text: string): JSONContent {
  const result: JSONContent = {
    type: "doc",
    content: [],
  };

  // 按双换行分割段落
  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    // 按单换行分割行
    const lines = para.split("\n");
    const paraContent: JSONContent[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 保留每一行（包括空格和缩进）
      if (line !== "") {
        paraContent.push({
          type: "text",
          text: line,
        });
      }

      // 添加换行（除了最后一行）
      if (i < lines.length - 1) {
        paraContent.push({
          type: "hardBreak",
        });
      }
    }

    if (paraContent.length > 0) {
      result.content!.push({
        type: "paragraph",
        content: paraContent,
      });
    }
  }

  // 如果没有内容，添加空段落
  if (!result.content || result.content.length === 0) {
    result.content = [
      {
        type: "paragraph",
        content: [],
      },
    ];
  }

  return result;
}

/**
 * 将 Markdown 转换为 TipTap JSON
 */
function markdownToTipTapJSON(markdown: string): JSONContent {
  const tokens = markdownit().parse(markdown, {});
  return convertTokensToTipTapJSON(tokens);
}

/**
 * 将 markdown-it tokens 转换为 TipTap JSON
 */
function convertTokensToTipTapJSON(tokens: Token[]): JSONContent {
  const result: JSONContent = {
    type: "doc",
    content: [],
  };

  let i = 0;
  while (i < tokens.length) {
    const node = parseToken(tokens, i);
    if (node.node) {
      result.content!.push(node.node);
    }
    i = node.nextIndex;
  }

  return result;
}

function parseToken(
  tokens: Token[],
  index: number,
): { node: JSONContent | null; nextIndex: number } {
  const token = tokens[index];

  if (!token) {
    return { node: null, nextIndex: index + 1 };
  }

  switch (token.type) {
    case "heading_open":
      return parseHeading(tokens, index);
    case "paragraph_open":
      return parseParagraph(tokens, index);
    case "ordered_list_open":
    case "bullet_list_open":
      return parseList(tokens, index);
    case "fence": // 代码块 ```
    case "code_block": // 缩进代码块
      return parseCodeBlock(tokens, index);
    case "hr":
      return parseHorizontalRule(tokens, index);
    case "blockquote_open":
      return parseBlockquote(tokens, index);
    default:
      return { node: null, nextIndex: index + 1 };
  }
}

function parseHeading(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  const openToken = tokens[index];
  const inlineToken = tokens[index + 1];

  if (!openToken || !inlineToken) {
    return {
      node: { type: "heading", attrs: { level: 1 }, content: [] },
      nextIndex: index + 3,
    };
  }

  const level = parseInt(openToken.tag.substring(1));
  const content = parseInlineContent(inlineToken);

  return {
    node: {
      type: "heading",
      attrs: { level },
      content,
    },
    nextIndex: index + 3,
  };
}

function parseParagraph(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  const inlineToken = tokens[index + 1];

  if (!inlineToken) {
    return {
      node: { type: "paragraph", content: [] },
      nextIndex: index + 3,
    };
  }

  const content = parseInlineContent(inlineToken);

  return {
    node: {
      type: "paragraph",
      content,
    },
    nextIndex: index + 3,
  };
}

function parseList(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  const openToken = tokens[index];

  if (!openToken) {
    return {
      node: { type: "bulletList", content: [] },
      nextIndex: index + 1,
    };
  }

  const isOrdered = openToken.type === "ordered_list_open";
  const listNode: JSONContent = {
    type: isOrdered ? "orderedList" : "bulletList",
    content: [],
  };

  let i = index + 1;
  while (i < tokens.length) {
    const currentToken = tokens[i];
    if (
      !currentToken ||
      currentToken.type === "ordered_list_close" ||
      currentToken.type === "bullet_list_close"
    ) {
      break;
    }
    if (currentToken.type === "list_item_open") {
      const listItem = parseListItem(tokens, i);
      if (listNode.content) {
        listNode.content.push(listItem.node);
      }
      i = listItem.nextIndex;
    } else {
      i++;
    }
  }

  return {
    node: listNode,
    nextIndex: i + 1,
  };
}

function parseListItem(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  const listItemNode: JSONContent = {
    type: "listItem",
    content: [],
  };

  let i = index + 1;
  while (i < tokens.length) {
    const currentToken = tokens[i];
    if (!currentToken || currentToken.type === "list_item_close") {
      break;
    }
    const parsed = parseToken(tokens, i);
    if (parsed.node && listItemNode.content) {
      listItemNode.content.push(parsed.node);
    }
    i = parsed.nextIndex;
  }

  return {
    node: listItemNode,
    nextIndex: i + 1,
  };
}

function parseCodeBlock(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  const token = tokens[index];

  if (!token) {
    return {
      node: { type: "codeBlock", content: [{ type: "text", text: "" }] },
      nextIndex: index + 1,
    };
  }

  // fence token 的 info 属性存储语言信息
  const language = token.info || null;
  const content = token.content || "";

  return {
    node: {
      type: "codeBlock",
      attrs: {
        language,
      },
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    },
    nextIndex: index + 1,
  };
}

function parseHorizontalRule(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  return {
    node: {
      type: "horizontalRule",
    },
    nextIndex: index + 1,
  };
}

function parseBlockquote(
  tokens: Token[],
  index: number,
): { node: JSONContent; nextIndex: number } {
  const blockquoteNode: JSONContent = {
    type: "blockquote",
    content: [],
  };

  let i = index + 1;
  while (i < tokens.length) {
    const currentToken = tokens[i];
    if (!currentToken || currentToken.type === "blockquote_close") {
      break;
    }
    const parsed = parseToken(tokens, i);
    if (parsed.node && blockquoteNode.content) {
      blockquoteNode.content.push(parsed.node);
    }
    i = parsed.nextIndex;
  }

  return {
    node: blockquoteNode,
    nextIndex: i + 1,
  };
}

function parseInlineContent(token: Token): JSONContent[] {
  if (!token.children) {
    return [{ type: "text", text: token.content }];
  }

  const content: JSONContent[] = [];
  let i = 0;

  while (i < token.children.length) {
    const child = token.children[i];

    if (!child) {
      i++;
      continue;
    }

    switch (child.type) {
      case "text":
        content.push({ type: "text", text: child.content });
        i++;
        break;

      case "code_inline":
        // 内联代码 `code`
        content.push({
          type: "text",
          text: child.content,
          marks: [{ type: "code" }],
        });
        i++;
        break;

      case "strong_open": {
        const strongContent = parseInlineMarks(
          token.children,
          i,
          "strong_close",
        );
        content.push({
          type: "text",
          text: strongContent.text,
          marks: [{ type: "bold" }],
        });
        i = strongContent.nextIndex;
        break;
      }

      case "em_open": {
        const emContent = parseInlineMarks(token.children, i, "em_close");
        content.push({
          type: "text",
          text: emContent.text,
          marks: [{ type: "italic" }],
        });
        i = emContent.nextIndex;
        break;
      }

      case "s_open": {
        const strikeContent = parseInlineMarks(token.children, i, "s_close");
        content.push({
          type: "text",
          text: strikeContent.text,
          marks: [{ type: "strike" }],
        });
        i = strikeContent.nextIndex;
        break;
      }

      case "link_open": {
        const linkContent = parseInlineMarks(token.children, i, "link_close");
        const href = child.attrs?.find((attr) => attr[0] === "href")?.[1] || "";
        content.push({
          type: "text",
          text: linkContent.text,
          marks: [{ type: "link", attrs: { href } }],
        });
        i = linkContent.nextIndex;
        break;
      }

      case "image": {
        const src = child.attrs?.find((attr) => attr[0] === "src")?.[1] || "";
        const alt = child.content || "";
        content.push({
          type: "image",
          attrs: {
            id: null,
            alt,
            src,
            title: null,
            width: null,
            height: null,
            fileName: null,
          },
        });
        i++;
        break;
      }

      case "hardbreak":
        content.push({ type: "hardBreak" });
        i++;
        break;

      case "softbreak":
        content.push({ type: "text", text: "\n" });
        i++;
        break;

      default:
        i++;
        break;
    }
  }

  return content;
}

function parseInlineMarks(
  children: Token[],
  startIndex: number,
  closeType: string,
): { text: string; nextIndex: number } {
  let text = "";
  let i = startIndex + 1;

  while (i < children.length) {
    const child = children[i];
    if (!child || child.type === closeType) {
      break;
    }
    if (child.type === "text") {
      text += child.content;
    } else if (child.type === "code_inline") {
      text += child.content;
    }
    i++;
  }

  return { text, nextIndex: i + 1 };
}

export {
  textToTipTapJSON,
  markdownToTipTapJSON,
  plainTextToTipTapJSON,
  convertTokensToTipTapJSON,
};
