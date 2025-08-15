import { sql, desc, and, eq, inArray, type SQL } from "drizzle-orm";

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
    // TODO: 向量命中时 access_count 加 1
    const qEmbArr = await embed(query);
    const qEmbText = toPgVectorLiteral(qEmbArr);

    // 提高召回（按需）
    await this.db.execute(sql`SET LOCAL ivfflat.probes = 10`);

    const lhs = sql`((${knowledgeBase.embedding})::tentix.halfvec(3072))`;
    const rhs = sql`((${qEmbText}::tentix.vector(3072))::tentix.halfvec(3072))`;
    const similarity = sql<number>`1 - (${lhs} OPERATOR(tentix.<=>) ${rhs})`;

    const conditions: SQL[] = [eq(knowledgeBase.isDeleted, false)];
    if (filters?.source_type?.length) {
      conditions.push(inArray(knowledgeBase.sourceType, filters.source_type));
    }
    if (filters?.module) {
      conditions.push(
        sql`(${knowledgeBase.metadata} ->> 'module') = ${filters.module}`,
      );
    }

    const qb = this.db
      .select({
        id: knowledgeBase.id,
        content: knowledgeBase.content,
        source_type: knowledgeBase.sourceType,
        source_id: knowledgeBase.sourceId,
        chunk_id: knowledgeBase.chunkId,
        metadata: knowledgeBase.metadata,
        similarity,
        score: knowledgeBase.score,
        accessCount: knowledgeBase.accessCount,
      })
      .from(knowledgeBase)
      .where(and(...conditions));

    const rough = await qb.orderBy(desc(similarity)).limit(Math.max(k * 3, 30));

    const reRank = rough
      .map((r) => {
        const w = SOURCE_WEIGHTS[r.source_type as SourceType] ?? 0.5;
        const final =
          Number(r.similarity) * w + Math.min((r.accessCount ?? 0) / 100, 0.05);
        return { ...r, final };
      })
      .sort((a, b) => b.final - a.final)
      .slice(0, k);

    return reRank.map((r) => ({
      id: String(r.id),
      content: r.content,
      source_type: r.source_type as SourceType,
      source_id: String(r.source_id),
      chunk_id: Number(r.chunk_id),
      score: r.final,
      metadata: r.metadata,
    }));
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
    namespace = "default",
  }: {
    source_type: string;
    source_id: string;
    namespace?: string;
  }) {
    await fetch(`${this.base}/deleteBySource`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_type, source_id, namespace }),
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
