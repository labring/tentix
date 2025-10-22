import {
  tickets,
  chatMessages,
  favoritedConversationsKnowledge,
} from "@/db/schema";
import { eq, asc, and, inArray } from "drizzle-orm";
import { connectDB } from "@/utils/tools";
import { VectorStore, KnowledgeBuilderConfig, KBChunk } from "./types.ts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { logWarning } from "@/utils/log";
import { OPENAI_CONFIG } from "./config.ts";
import { getAbbreviatedText, type JSONContentZod } from "../types.ts";
import { basicUserCols } from "../../api/queryParams.ts";
import { getTextWithImageInfo, extractImageUrls } from "./tools.ts";

function truncateString(input: string, maxLen: number): string {
  if (!input) return "";
  if (input.length <= maxLen) return input;
  return `${input.slice(0, Math.max(0, maxLen - 1))}…`;
}

function normalizeWhitespace(input: string): string {
  return (input || "")
    .replace(/\s+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

// 获取消息的纯文本内容（用于知识库构建）
function getTextContent(content: JSONContentZod, maxLength: number): string {
  const text = getTextWithImageInfo(content);
  return getAbbreviatedText(
    { type: "text", text } as JSONContentZod,
    maxLength,
  );
}

/*
1. [2025-08-14 09:31:22] 用户: 我这边登录报错，提示 Token 失效...
2. [2025-08-14 09:32:05] 客服: 请确认本地时间是否正确，并尝试重新获取登录二维码...
3. [2025-08-14 09:33:47] 技术: 我们刚发布了修复补丁，请刷新页面后重试...
4. [2025-08-14 09:34:10] AI: 根据历史案例，若仍失败，可尝试清理浏览器缓存后再登录...
5. [2025-08-14 09:35:22] 用户: 还是报错,内容如图所示，[图片: https://xxxx.com/xx.png]
*/
function formatMessagesForAI(
  msgs: Array<{
    isInternal?: boolean | null;
    withdrawn?: boolean | null;
    senderId?: string | number | null;
    createdAt?: string | null;
    content: JSONContentZod;
    sender?: { role?: string | null } | null;
  }>,
  customerId?: string | number | null,
  options?: { perMessageMax?: number; enumerate?: boolean },
): string {
  const perMessageMax = options?.perMessageMax ?? 500; // 限制每条消息长度，避免极端长文本
  let idx = 0;
  const roleLabel = (role?: string, senderId?: string | number | null) => {
    const r = (role || "").toLowerCase();
    if (r === "ai") return "AI";
    if (r === "agent") return "客服";
    if (r === "technician") return "技术";
    if (r === "customer" || r === "user") return "用户";
    // 回退规则：根据 senderId 与 customerId 的一致性判断
    return senderId === customerId ? "用户" : "客服";
  };
  const lines = msgs
    .filter((m) => !m.isInternal && !m.withdrawn)
    .map((m) => {
      const role = roleLabel(m?.sender?.role ?? undefined, m?.senderId);
      const text = truncateString(
        normalizeWhitespace(getTextContent(m.content, perMessageMax)),
        perMessageMax,
      );
      const ts = m?.createdAt
        ? new Date(m.createdAt)
            .toISOString()
            .replace("T", " ")
            .replace(/\..+$/, "")
        : "";
      const prefix = options?.enumerate ? `${++idx}. ` : "";
      return `${prefix}${ts ? `[${ts}] ` : ""}${role}: ${text}`;
    })
    .filter(Boolean);
  return lines.join("\n");
}

function splitIntoChunks(text: string, max = 1200): string[] {
  // 1) 先按空行分段
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  const pushBuf = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };
  const tryAppend = (piece: string) => {
    const cand = buf ? `${buf}\n\n${piece}` : piece;
    if (cand.length <= max) {
      buf = cand;
      return true;
    }
    return false;
  };
  for (const p of paras) {
    if (tryAppend(p)) continue;
    // 2) 过长段落：按句号/问号/感叹号等切
    const sentences = p.split(/(?<=[。！？!?.])\s+|\n+/);
    let local = "";
    const flushLocal = () => {
      if (local.trim()) {
        if (!tryAppend(local)) {
          // 3) 句子仍然过长：再按字符硬切
          for (let i = 0; i < local.length; i += max) {
            const slice = local.slice(i, i + max);
            if (!tryAppend(slice)) {
              pushBuf();
              buf = slice;
            }
          }
        }
      }
      local = "";
    };
    for (const s of sentences) {
      const next = local ? `${local} ${s}` : s;
      if (next.length > max) {
        flushLocal();
        local = s;
      } else {
        local = next;
      }
    }
    flushLocal();
  }
  pushBuf();
  return chunks;
}

const schema = z.object({
  problem_summary: z.string().describe("用户问题的简要中文概括"),
  solution_steps: z
    .array(z.string())
    .describe("为解决该问题采取的关键步骤，按顺序给出"),
  generated_queries: z
    .array(z.string())
    .describe("适合用来检索知识库的查询词或关键词"),
  tags: z
    .array(z.string())
    .default([])
    .describe("该问题的主题标签，3-8 个中文或英文关键词"),
});

export class KnowledgeBuilderService {
  private externalProvider?: VectorStore;
  private internalProvider?: VectorStore;

  private db: ReturnType<typeof connectDB>;
  constructor(config: KnowledgeBuilderConfig) {
    this.db = config.db;
    this.externalProvider = config.externalProvider;
    this.internalProvider = config.internalProvider;
  }

  /**
   * 构建收藏对话的知识库
   */
  async buildFavoritedConversations(
    ticketId: string,
    favorited: typeof favoritedConversationsKnowledge.$inferSelect,
  ): Promise<void> {
    const store =
      OPENAI_CONFIG.vectorBackend === "external"
        ? this.externalProvider
        : this.internalProvider;

    const t = await this.db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
    });
    if (!t) return;

    if (!favorited) return;

    const msgsIds = favorited?.messageIds;

    const msgs = await this.db.query.chatMessages.findMany({
      where:
        msgsIds && msgsIds.length
          ? and(
              eq(chatMessages.ticketId, ticketId),
              inArray(chatMessages.id, msgsIds),
            )
          : eq(chatMessages.ticketId, ticketId),
      orderBy: asc(chatMessages.createdAt),
      with: {
        sender: basicUserCols,
      },
    });

    // 对话格式优化：统一“用户/客服”角色名、可选时间戳、逐条编号，并限制单条消息与整体长度
    const joined = formatMessagesForAI(
      msgs.map((m) => ({
        isInternal: m.isInternal,
        withdrawn: m.withdrawn,
        senderId: m.senderId as number | string,
        createdAt: m.createdAt,
        content: m.content as JSONContentZod,
        sender: (m as unknown as { sender?: { role?: string | null } }).sender,
      })),
      t.customerId as unknown as string | number | null,
      {
        perMessageMax: 5000,
        enumerate: true,
      },
    );

    const ticketDesc = getTextContent(t.description as JSONContentZod, 2000);
    const safeTitle = truncateString(t.title ?? "", 500);
    // AI 增强摘要（用于构建高信息密度的知识内容）
    let problem_summary = "",
      solution_steps: string[] = [],
      generated_queries: string[] = [],
      tags: string[] = [];
    try {
      const model = new ChatOpenAI({
        apiKey: OPENAI_CONFIG.apiKey,
        model: OPENAI_CONFIG.summaryModel,
        configuration: {
          baseURL: OPENAI_CONFIG.baseURL,
        },
      });

      const structured = model.withStructuredOutput(schema);

      // 构建多模态消息，包含工单描述和历史对话中的图片
      const ticketDescImages = extractImageUrls(
        t.description as JSONContentZod,
      );

      // 提取历史对话中的所有图片
      const conversationImages: string[] = [];
      for (const m of msgs) {
        if (m && m.content) {
          const msgImages = extractImageUrls(m.content as JSONContentZod);
          conversationImages.push(...msgImages);
        }
      }

      const promptText = [
        "请阅读以下客服工单的基本信息与按时间排序的对话，仅基于这些已知事实生成严格有效的 JSON。禁止任何多余说明、前后缀或 Markdown。输出结构必须完全符合：",
        '{ "problem_summary": string, "solution_steps": string[], "generated_queries": string[], "tags": string[] }',
        "",
        "生成规则（务必逐条遵守）：",
        "1) problem_summary：用中文精准概括用户问题，不引入未在工单或对话中出现的推断。",
        "2) solution_steps：严格依据“客服/技术”在对话中明确给出的处理方案与操作顺序整理；如无明确方案，只总结已尝试或已建议的步骤，不得自创步骤或扩展不存在的功能；AI 的建议若未被客服/技术确认，不得采纳。若有可复用的相似场景处理方式，可在步骤末尾附加 1-3 条，并以“（相似场景）”前缀标注。",
        "3) generated_queries：用于检索知识库的高精度检索词，优先包含产品/模块名、分类、错误码/提示语、关键操作、环境信息等；避免泛化词（如“问题”“报错”“怎么解决”）；长度适中，避免重复。",
        "4) tags：3-8 个高置信标签，优先选用领域词与工单中出现的关键实体（模块、分类、错误码、产品版本等）；去重；避免过于宽泛的词。",
        "5) 若信息不足，对应字段置为空字符串或空数组，绝不臆测。",
        "6) 不得引用本指令文本；不得输出解释；确保 JSON 可被 JSON.parse 正确解析。",
        "",
        "工单信息：",
        `- 标题: ${safeTitle}`,
        `- 描述: ${ticketDesc}`,
        `- 分类: ${t.category}`,
        `- 模块: ${t.module}`,
        "",
        "对话记录（按时间排序）：",
        joined,
      ].join("\n");

      // 收集所有图片
      const allImages = [...ticketDescImages, ...conversationImages];

      let summaryInput;
      if (allImages.length > 0) {
        // 如果有图片，构建多模态消息（正确的 LangChain 消息格式）
        summaryInput = [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              ...allImages.map((url) => ({
                type: "image_url",
                image_url: { url },
              })),
            ],
          },
        ];
      } else {
        // 否则使用纯文本
        summaryInput = promptText;
      }

      const j = await structured.invoke(summaryInput);

      problem_summary = j.problem_summary ?? "";
      solution_steps = j.solution_steps ?? [];
      generated_queries = j.generated_queries ?? [];
      tags = j.tags ?? [];
    } catch (err) {
      logWarning(
        `KnowledgeBuilderService structured summary failed: ${String(err)}`,
      );
    }

    // 组合 AI 增强后的知识内容（信息密度更高，更利于向量检索）
    const enhanced = [
      `问题: ${problem_summary || safeTitle}`,
      solution_steps.length
        ? `解决步骤:\n- ${solution_steps.join("\n- ")}`
        : "",
      generated_queries.length
        ? `搜索关键词: ${generated_queries.join(", ")}`
        : "",
      tags.length ? `标签: ${tags.join(", ")}` : "",
      "",
      "原始工单信息:",
      `- 标题: ${safeTitle}`,
      `- 描述: ${ticketDesc}`,
      `- 模块: ${t.module}`,
      `- 分类: ${t.category}`,
      `- 区域: ${t.area}`,
      "",
    ]
      .filter(Boolean)
      .join("\n");

    // 1) 写入一条 AI 增强摘要文档（chunk_id: 0）
    const summaryDoc: KBChunk = {
      source_type: "favorited_conversation",
      source_id: ticketId,
      chunk_id: 0,
      title: safeTitle,
      content: enhanced,
      metadata: {
        ticket_id: ticketId,
        module: t.module,
        area: t.area,
        category: t.category,
        problem_summary,
        solution_steps,
        generated_queries,
        tags,
        is_summary: true,
      },
    };

    // 2) 将收藏对话的所有消息文本进行切块索引（chunk_id: 从 1 开始）
    const chunks = splitIntoChunks(joined);
    const messageDocs: KBChunk[] = chunks.map((content, i) => ({
      source_type: "favorited_conversation",
      source_id: ticketId,
      chunk_id: i + 1,
      title: `${safeTitle}（对话）`,
      content,
      metadata: {
        ticket_id: ticketId,
        module: t.module,
        area: t.area,
        category: t.category,
        problem_summary,
        solution_steps,
        generated_queries,
        tags,
        is_summary: false,
      },
    }));

    await store?.upsert([summaryDoc, ...messageDocs]);
  }
}
