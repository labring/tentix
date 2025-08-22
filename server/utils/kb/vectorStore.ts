import { sql, asc, and, eq, inArray, type SQL } from "drizzle-orm";

import { knowledgeBase } from "@/db/schema";
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

      // 轻度 re-rank：以距离为主，来源权重与热度做微调，输出 score 越大越相关
      // 访问次数高的内容在相似度接近时会被优先推荐
      const ranked = rough
        .map((r) => {
          const w = SOURCE_WEIGHTS[r.source_type as SourceType] ?? 0.5;
          const dist = Number(r.distance); // 0..2（cosine）
          const relevance = Math.max(0, 1 - Math.min(dist, 1)); // 0..1
          const boost = Math.min((r.accessCount ?? 0) / 100, 0.05); // ≤ 0.05 热度加分(访问次数)
          const final = relevance * w + boost; // 最终得分 = 相关度×权重 + 热度加分
          return { ...r, final };
        })
        .sort((a, b) => b.final - a.final)
        .slice(0, k);

      if (ranked.length > 0) {
        const ids = ranked.map((r) => r.id);
        await tx
          .update(knowledgeBase)
          .set({
            accessCount: sql`COALESCE(${knowledgeBase.accessCount}, 0) + 1`,
            updatedAt: sql`NOW()`,
          })
          .where(inArray(knowledgeBase.id, ids));
      }

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
}
