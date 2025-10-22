import markdownit from "markdown-it";
import type { Token } from "markdown-it/index.js";
import type { JSONContent } from "@tiptap/core";

/**
 * Convert markdown text to TipTap JSONContent format
 * @param markdown - The markdown string to convert
 * @returns TipTap JSONContent object
 */
function markdownToTipTapJSON(markdown: string): JSONContent {
  const tokens = markdownit().parse(markdown, {});
  return convertTokensToTipTapJSON(tokens);
}

/**
 * Convert markdown-it tokens to TipTap JSONContent format
 * @param tokens - Array of markdown-it tokens
 * @returns TipTap JSONContent object
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

  const level = parseInt(openToken.tag.substring(1)); // h1 -> 1, h2 -> 2, etc.

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
    }
    i++;
  }

  return { text, nextIndex: i + 1 };
}

export { markdownToTipTapJSON, convertTokensToTipTapJSON };
