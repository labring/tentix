import {
  tickets,
  chatMessages,
  favoritedConversationsKnowledge,
} from "@/db/schema";
import { eq, asc, and, inArray } from "drizzle-orm";
import { connectDB } from "@/utils/tools";
import { VectorStore, KnowledgeBuilderConfig, KBChunk } from "./types";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { logWarning } from "@/utils/log";
import { OPENAI_CONFIG } from "./config";
import { getAbbreviatedText, type JSONContentZod } from "../types";
import { basicUserCols } from "../../api/queryParams.ts";

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

/*
1. [2025-08-14 09:31:22] 用户: 我这边登录报错，提示 Token 失效...
2. [2025-08-14 09:32:05] 客服: 请确认本地时间是否正确，并尝试重新获取登录二维码...
3. [2025-08-14 09:33:47] 技术: 我们刚发布了修复补丁，请刷新页面后重试...
4. [2025-08-14 09:34:10] AI: 根据历史案例，若仍失败，可尝试清理浏览器缓存后再登录...
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
        normalizeWhitespace(getAbbreviatedText(m.content, perMessageMax)),
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
  // 优先按空行分段，再在过长的段内做二次切分，尽量避免语义被截断
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length > max) {
      if (buf) chunks.push(buf);
      // 对超长段落按句号/换行进行二次切分
      const parts = p.split(/(?<=[。.!?])\s+|\n+/);
      let local = "";
      for (const part of parts) {
        const cand2 = local ? `${local} ${part}` : part;
        if (cand2.length > max) {
          if (local) chunks.push(local);
          local = part;
        } else {
          local = cand2;
        }
      }
      if (local) chunks.push(local);
      buf = "";
    } else {
      buf = candidate;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

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

    const ticketDesc = getAbbreviatedText(t.description, 2000);
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

      const structured = model.withStructuredOutput(schema);
      const j = await structured.invoke(
        `阅读以下客服工单的基本信息和对话内容，输出严格符合模式的 JSON（不要额外解释）：{ "problem_summary": string, "solution_steps": string[], "generated_queries": string[], "tags": string[] }\n\n工单信息：\n- 标题: ${safeTitle}\n- 描述: ${ticketDesc}\n- 分类: ${t.category}\n- 模块: ${t.module}\n\n对话记录（按时间排序）：\n${joined}`,
      );

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
