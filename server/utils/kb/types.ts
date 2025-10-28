import { connectDB } from "@/utils/tools";

export type SourceType =
  | "favorited_conversation"
  | "historical_ticket"
  | "general_knowledge";

export interface KBChunk {
  source_type: SourceType;
  source_id: string;
  chunk_id: number;
  title?: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface KBFilter {
  module?: string;
  source_type?: SourceType[];
}

export interface SearchHit {
  id: string;
  content: string;
  source_type: SourceType;
  source_id?: string;
  chunk_id?: number;
  score: number;
  metadata: unknown;
}

export interface VectorStore {
  upsert(docs: KBChunk[]): Promise<void>;
  search(args: {
    query: string;
    k: number;
    filters?: KBFilter;
  }): Promise<SearchHit[]>;
  deleteBySource(source: {
    source_type: string;
    source_id: string;
  }): Promise<void>;
  health(): Promise<{ ok: boolean; info?: unknown }>;

  // 批量更新访问次数（用于去重后的统一统计）
  // 同时记录知识库访问日志
  updateAccessCount(
    chunkIds: string[],
    options: {
      userQuery: string;
      aiGenerateQueries?: string[];
      ticketId?: string;
      ticketModule?: string;
      ragDuration?: number;
    },
  ): Promise<void>;

  // 可选：按来源获取所有分片或邻接分片（用于上下文扩展）
  getBySource?(args: {
    source_type: string;
    source_id: string;
  }): Promise<SearchHit[]>;
  getNeighbors?(args: {
    source_type: string;
    source_id: string;
    chunk_id: number;
    window?: number;
  }): Promise<SearchHit[]>;
}

export interface KnowledgeBuilderConfig {
  externalProvider?: VectorStore;
  internalProvider?: VectorStore;
  db: ReturnType<typeof connectDB>;
}
