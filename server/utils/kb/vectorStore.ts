import { sql, asc, and, eq, inArray, type SQL } from "drizzle-orm";

import { knowledgeBase, knowledgeAccessLog } from "@/db/schema";
import {
  KBChunk,
  KBFilter,
  SearchHit,
  VectorStore,
  type SourceType,
} from "./types";
import { OPENAI_CONFIG, SOURCE_WEIGHTS } from "./config";
import { OpenAIEmbeddings } from "@langchain/openai";
import { connectDB } from "../tools";

function hash(s: string) {
  return Bun.hash(s).toString(); // Bun 环境
}
function toPgVectorLiteral(vec: number[]): string {
  // 统一用 '.' 小数点、去掉 NaN/Infinity，限制精度减少体积
  return `[${vec.map((x) => (Number.isFinite(x) ? Number(x).toFixed(6) : "0")).join(",")}]`;
}

// 计算一年中的第几周（ISO 8601 标准）
function getWeekOfYear(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const embedder = new OpenAIEmbeddings({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.embeddingModel,
  // 可选：降维（仅 text-embedding-3-* 支持）
  dimensions: 3072, // 或 1536 / 1024 等
  // 可选：批处理大小、超时、重试等
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
  batchSize: 64,
  timeout: 60_000,
  maxRetries: 3,
});

async function embed(text: string): Promise<number[]> {
  const input = text.replace(/\s+/g, " ").slice(0, 8000);
  return embedder.embedQuery(input); // 返回 number[]
}

export class PgVectorStore implements VectorStore {
  private db: ReturnType<typeof connectDB>;
  constructor(db: ReturnType<typeof connectDB>) {
    this.db = db;
  }
  async upsert(docs: KBChunk[]) {
    for (const d of docs) {
      const emb = await embed(d.content);
      const contentHash = hash(
        `${d.source_type}:${d.source_id}:${d.chunk_id}:${d.content}`,
      );

      const embVec = toPgVectorLiteral(emb);

      await this.db
        .insert(knowledgeBase)
        .values({
          sourceType: d.source_type,
          sourceId: d.source_id,
          chunkId: d.chunk_id,
          title: d.title ?? "",
          content: d.content,
          embedding: sql`${embVec}::tentix.vector(3072)`,
          metadata: d.metadata,
          contentHash,
          score: Math.round((SOURCE_WEIGHTS[d.source_type] ?? 0.5) * 100),
        })
        .onConflictDoUpdate({
          target: [
            knowledgeBase.sourceType,
            knowledgeBase.sourceId,
            knowledgeBase.chunkId,
          ],
          set: {
            content: d.content,
            embedding: sql`${embVec}::tentix.vector(3072)`,
            metadata: d.metadata,
            updatedAt: sql`NOW()`,
          },
        });
    }
  }

  async search({
    query,
    k,
    filters,
  }: {
    query: string;
    k: number;
    filters?: KBFilter;
  }): Promise<SearchHit[]> {
    return await this.db.transaction(async (tx) => {
      const qEmbArr = await embed(query);
      const qEmbText = toPgVectorLiteral(qEmbArr);

      // 使用 set_config，支持参数化，并将作用域限定在当前事务（第三个参数为 true）
      const probes = Math.min(Math.max(8, k * 2), 200);
      await tx.execute(
        sql`select set_config('ivfflat.probes', ${String(probes)}, true)`,
      );

      // 与 ivfflat 索引一致：halfvec + cosine 距离（<=>），按“距离升序”排序
      const lhs = sql`((${knowledgeBase.embedding})::tentix.halfvec(3072))`;
      const rhs = sql`((${qEmbText}::tentix.vector(3072))::tentix.halfvec(3072))`;
      const distance = sql<number>`(${lhs} OPERATOR(tentix.<=>) ${rhs})`;

      const conditions: SQL[] = [eq(knowledgeBase.isDeleted, false)];
      if (filters?.source_type?.length) {
        conditions.push(inArray(knowledgeBase.sourceType, filters.source_type));
      }
      if (filters?.module) {
        conditions.push(
          sql`(${knowledgeBase.metadata} ->> 'module') = ${filters.module}`,
        );
      }

      const qb = tx
        .select({
          id: knowledgeBase.id,
          content: knowledgeBase.content,
          source_type: knowledgeBase.sourceType,
          source_id: knowledgeBase.sourceId,
          chunk_id: knowledgeBase.chunkId,
          metadata: knowledgeBase.metadata,
          distance,
          scoreCol: knowledgeBase.score,
          accessCount: knowledgeBase.accessCount,
        })
        .from(knowledgeBase)
        .where(and(...conditions));

      const candidateLimit = Math.max(k * 3, 30);
      const rough = await qb.orderBy(asc(distance)).limit(candidateLimit);

      // 轻度 re-rank：以向量相似度为主，结合来源权重与热度做微调
      // 目标：相似度高、来源可信、访问多的内容排在前面
      const ranked = rough
        .map((r) => {
          const dist = Number(r.distance); // cosine 距离 ∈ [0, 2]
          
          // 1. 计算基础相关度分数 [0, 1]
          // cosine 距离 0 = 完全相同（最相关）
          // cosine 距离 1 = 正交（不相关）
          // cosine 距离 > 1 = 反向（负相关，截断为 0）
          const relevance = Math.max(0, 1 - dist);
          
          // 2. 来源权重：不同来源的可信度不同
          // 精选案例 > 历史工单 > 通用知识
          const sourceWeight = SOURCE_WEIGHTS[r.source_type as SourceType] ?? 0.5;
          
          // 3. 热度加分：访问次数多说明该知识常用且可能更有价值
          // 上限 0.05，避免热度完全主导排序
          const heatBoost = Math.min((r.accessCount ?? 0) / 100, 0.05);
          
          // 4. 最终得分 = 相关度 × 来源权重 + 热度加分
          // 理论最大值：1.0 × 1.0 + 0.05 = 1.05
          // 理论最小值：0
          const final = relevance * sourceWeight + heatBoost;
          
          return { ...r, final };
        })
        .sort((a, b) => b.final - a.final)
        .slice(0, k);

      return ranked.map((r) => ({
        id: String(r.id),
        content: r.content,
        source_type: r.source_type as SourceType,
        source_id: String(r.source_id),
        chunk_id: Number(r.chunk_id),
        score: r.final,
        metadata: r.metadata,
      }));
    });
  }

  async deleteBySource({
    source_type,
    source_id,
  }: {
    source_type: string;
    source_id: string;
  }) {
    await this.db
      .delete(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.sourceType, source_type),
          eq(knowledgeBase.sourceId, source_id),
        ),
      );
  }

  async health() {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { ok: true };
    } catch (e) {
      return { ok: false, info: String(e) };
    }
  }

  async getBySource({
    source_type,
    source_id,
  }: {
    source_type: string;
    source_id: string;
  }): Promise<SearchHit[]> {
    const rows = await this.db
      .select({
        id: knowledgeBase.id,
        content: knowledgeBase.content,
        source_type: knowledgeBase.sourceType,
        source_id: knowledgeBase.sourceId,
        chunk_id: knowledgeBase.chunkId,
        metadata: knowledgeBase.metadata,
        score: knowledgeBase.score,
        accessCount: knowledgeBase.accessCount,
      })
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.isDeleted, false),
          eq(knowledgeBase.sourceType, source_type),
          eq(knowledgeBase.sourceId, source_id),
        ),
      )
      .orderBy(knowledgeBase.chunkId);

    return rows.map((r) => ({
      id: String(r.id),
      content: r.content,
      source_type: r.source_type as SourceType,
      source_id: String(r.source_id),
      chunk_id: Number(r.chunk_id),
      score: Number(r.score ?? 0),
      metadata: r.metadata,
    }));
  }

  async getNeighbors({
    source_type,
    source_id,
    chunk_id,
    window = 1,
  }: {
    source_type: string;
    source_id: string;
    chunk_id: number;
    window?: number;
  }): Promise<SearchHit[]> {
    const min = Math.max(0, chunk_id - window);
    const max = chunk_id + window;
    const rows = await this.db
      .select({
        id: knowledgeBase.id,
        content: knowledgeBase.content,
        source_type: knowledgeBase.sourceType,
        source_id: knowledgeBase.sourceId,
        chunk_id: knowledgeBase.chunkId,
        metadata: knowledgeBase.metadata,
        score: knowledgeBase.score,
      })
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.isDeleted, false),
          eq(knowledgeBase.sourceType, source_type),
          eq(knowledgeBase.sourceId, source_id),
          sql`${knowledgeBase.chunkId} BETWEEN ${min} AND ${max}`,
        ),
      )
      .orderBy(knowledgeBase.chunkId);

    return rows.map((r) => ({
      id: String(r.id),
      content: r.content,
      source_type: r.source_type as SourceType,
      source_id: String(r.source_id),
      chunk_id: Number(r.chunk_id),
      score: Number(r.score ?? 0),
      metadata: r.metadata,
    }));
  }

  /**
   * 批量更新访问次数（用于去重后的统一统计）
   * 确保同一次对话中，每个 chunk 只被计数一次
   * 同时记录知识库访问日志
   */
  async updateAccessCount(
    chunkIds: string[],
    options: {
      userQuery: string;
      aiGenerateQueries?: string[];
      ticketId?: string;
      ticketModule?: string;
      ragDuration?: number;
    },
  ): Promise<void> {
    if (chunkIds.length === 0) return;

    const now = new Date();
    const dateDay = now.toISOString().split("T")[0]!; // YYYY-MM-DD
    const dateHour = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0,
    ).toISOString(); // YYYY-MM-DD HH:00:00
    const hourOfDay = now.getHours(); // 0-23
    const dayOfWeek = now.getDay() || 7; // 1-7 (周日为7)
    const weekOfYear = getWeekOfYear(now); // 1-53
    const monthOfYear = now.getMonth() + 1; // 1-12
    const yearMonth = `${now.getFullYear()}-${String(monthOfYear).padStart(2, "0")}`; // YYYY-MM

    await this.db.transaction(async (tx) => {
      // 1. 更新访问次数
      await tx
        .update(knowledgeBase)
        .set({
          accessCount: sql`COALESCE(${knowledgeBase.accessCount}, 0) + 1`,
          updatedAt: sql`NOW()`,
        })
        .where(inArray(knowledgeBase.id, chunkIds));

      // 2. 记录访问日志（为每个 chunk 创建一条记录）
      const accessLogs = chunkIds.map((knowledgeBaseId) => ({
        userQuery: options.userQuery,
        aiGenerateQueries: options.aiGenerateQueries || [],
        knowledgeBaseId,
        ticketId: options.ticketId || null,
        ticketModule: options.ticketModule || null,
        ragDuration: options.ragDuration || null,
        dateDay,
        dateHour,
        hourOfDay,
        dayOfWeek,
        weekOfYear,
        monthOfYear,
        yearMonth,
      }));

      await tx.insert(knowledgeAccessLog).values(accessLogs);
    });
  }
}

export class ExternalHttpStore implements VectorStore {
  private base: string;
  constructor(base: string) {
    this.base = base;
  }
  async upsert(docs: KBChunk[]) {
    const res = await fetch(`${this.base}/upsert`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ docs }),
    });
    if (!res.ok) throw new Error(`external upsert failed: ${await res.text()}`);
  }

  async search({
    query,
    k,
    filters,
  }: {
    query: string;
    k: number;
    filters?: KBFilter;
  }): Promise<SearchHit[]> {
    const res = await fetch(`${this.base}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, k, filters }),
    });
    if (!res.ok) throw new Error(`external search failed: ${await res.text()}`);
    const data = await res.json();
    // 期望外部服务返回包含 source_id 与 chunk_id；若缺失可为空
    return data.data as SearchHit[];
  }

  async deleteBySource({
    source_type,
    source_id,
  }: {
    source_type: string;
    source_id: string;
  }) {
    await fetch(`${this.base}/deleteBySource`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_type, source_id }),
    });
  }

  async getBySource({
    source_type,
    source_id,
  }: {
    source_type: string;
    source_id: string;
  }): Promise<SearchHit[]> {
    const res = await fetch(`${this.base}/getBySource`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_type, source_id }),
    });
    if (!res.ok)
      throw new Error(`external getBySource failed: ${await res.text()}`);
    const data = await res.json();
    return data.data as SearchHit[];
  }

  async getNeighbors({
    source_type,
    source_id,
    chunk_id,
    window = 1,
  }: {
    source_type: string;
    source_id: string;
    chunk_id: number;
    window?: number;
  }): Promise<SearchHit[]> {
    const res = await fetch(`${this.base}/getNeighbors`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_type, source_id, chunk_id, window }),
    });
    if (!res.ok)
      throw new Error(`external getNeighbors failed: ${await res.text()}`);
    const data = await res.json();
    return data.data as SearchHit[];
  }

  async health() {
    const res = await fetch(`${this.base}/health`);
    return { ok: res.ok, info: await res.text() };
  }

  /**
   * 批量更新访问次数（用于去重后的统一统计）
   * 同时记录知识库访问日志
   */
  async updateAccessCount(
    chunkIds: string[],
    options: {
      userQuery: string;
      aiGenerateQueries?: string[];
      ticketId?: string;
      ticketModule?: string;
      ragDuration?: number;
    },
  ): Promise<void> {
    if (chunkIds.length === 0) return;

    await fetch(`${this.base}/updateAccessCount`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chunkIds, options }),
    });
  }
}
