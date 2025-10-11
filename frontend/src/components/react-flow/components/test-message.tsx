import { type Message } from "@comp/ai-chat/chat-message";
import { type JSONContent } from "@tiptap/react";
export const messages: Message[] = [
  // 1. 普通字符串消息（用户）
  {
    id: "1",
    role: "user",
    content: "Hello, how are you?",
    createdAt: new Date(),
  },

  // 2. 普通字符串消息（助手）
  {
    id: "2",
    role: "assistant",
    content: "I'm doing well, thank you for asking!",
  },

  // 3. JSONContent 格式消息（用户 - 富文本）
  {
    id: "3",
    role: "user",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Can you help me with " },
            {
              type: "text",
              text: "bold text",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "italic text",
              marks: [{ type: "italic" }],
            },
            { type: "text", text: "?" },
          ],
        },
      ],
    } as JSONContent,
    createdAt: new Date(),
  },

  // 4. JSONContent 格式消息（用户 - 代码块）
  {
    id: "4",
    role: "user",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Here's my code:" }],
        },
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [
            {
              type: "text",
              text: "const greeting = 'Hello World';\nconsole.log(greeting);",
            },
          ],
        },
      ],
    } as JSONContent,
    createdAt: new Date(),
  },

  // 5. 带 parts 的消息（包含 reasoning + text JSONContent）
  {
    id: "5",
    role: "assistant",
    content: "",
    parts: [
      {
        type: "reasoning",
        reasoning: "用户想要了解富文本功能，我需要展示不同的格式...",
      },
      {
        type: "text",
        text: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "富文本示例" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "这是一个包含多种格式的回复：" }],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "粗体文本",
                          marks: [{ type: "bold" }],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "斜体文本",
                          marks: [{ type: "italic" }],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "代码",
                          marks: [{ type: "code" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        } as JSONContent,
      },
    ],
  },

  // 6. 带工具调用和 JSONContent 的复杂消息
  {
    id: "6",
    role: "assistant",
    content: "",
    parts: [
      {
        type: "reasoning",
        reasoning: "需要搜索相关信息...",
      },
      {
        type: "tool-invocation",
        toolInvocation: {
          state: "call",
          toolName: "web_search",
        },
      },
      {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          toolName: "web_search",
          result: {
            query: "TipTap editor",
            results: ["Result 1", "Result 2"],
          },
        },
      },
      {
        type: "text",
        text: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "根据搜索结果，" },
                {
                  type: "text",
                  text: "TipTap",
                  marks: [{ type: "bold" }],
                },
                { type: "text", text: " 是一个强大的富文本编辑器。" },
              ],
            },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "访问官网：" },
                {
                  type: "text",
                  text: "https://tiptap.dev",
                  marks: [
                    {
                      type: "link",
                      attrs: { href: "https://tiptap.dev" },
                    },
                  ],
                },
              ],
            },
          ],
        } as JSONContent,
      },
    ],
  },

  // 7. 带附件的用户消息
  {
    id: "7",
    role: "user",
    content: "请查看这些文件",
    experimental_attachments: [
      {
        name: "document.pdf",
        contentType: "application/pdf",
        url: "data:image/jpeg;base64,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",
      },
      {
        name: "image.png",
        contentType: "image/png",
        url: "data:image/jpeg;base64,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",
      },
    ],
    createdAt: new Date(),
  },

  // 8. 表格格式的 JSONContent
  {
    id: "8",
    role: "assistant",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "这是一个数据对比表：" }],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "功能" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "支持情况" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "富文本" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "✅ 支持" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Markdown" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "✅ 支持" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as JSONContent,
  },
];
