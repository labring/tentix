import {
  WorkflowState,
  getVariables,
  buildMultimodalUserContent,
  DEFAULT_API_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  sanitizeQuery,
  getStore,
  hasSummaryFlag,
} from "./workflow-tools";
import { z } from "zod";
import { RagConfig } from "@/utils/const";
import { renderTemplate as renderLiquidTemplate } from "@/utils/template";
import { ChatOpenAI } from "@langchain/openai";
import { logError } from "@/utils";
import { type SearchHit, type VectorStore } from "../types";
import { quickNoSearchHeuristic } from "../tools";

const decisionSchema = z.object({
  action: z.enum(["NEED_SEARCH", "NO_SEARCH"]),
  reasons: z.array(z.string()).max(10).default([]),
});

const qsSchema = z.object({
  queries: z.array(z.string().min(2).max(80)).min(2).max(3),
});

export async function ragNode(
  state: WorkflowState,
  config: RagConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  let retrievedContext: Array<SearchHit> = [];
  const store = getStore();
  let shouldSearch = true;

  if (config.enableIntentAnalysis) {
    // 先执行快速启发式判断，避免不必要的对象创建
    if (quickNoSearchHeuristic(variables.lastCustomerMessage)) {
      shouldSearch = false;
      return { retrievedContext: [] };
    }

    // 快速判断未命中，才创建 LLM 实例
    const chat = new ChatOpenAI({
      apiKey:
        config.intentAnalysisConfig?.intentAnalysisLLM?.apiKey ||
        DEFAULT_API_KEY,
      model:
        config.intentAnalysisConfig?.intentAnalysisLLM?.model || DEFAULT_MODEL,
      configuration: {
        baseURL:
          config.intentAnalysisConfig?.intentAnalysisLLM?.baseURL ||
          DEFAULT_BASE_URL,
      },
    });

    const systemPrompt = await renderLiquidTemplate(
      config.intentAnalysisConfig?.intentAnalysisSystemPrompt,
      variables,
    );

    // 2) 用户提示（多模态文本 + 最近客户图片；工单图不传以减小噪音）
    const userPrompt = await renderLiquidTemplate(
      config.intentAnalysisConfig?.intentAnalysisUserPrompt,
      variables,
    );

    const fastStructured = chat.withStructuredOutput(decisionSchema);

    // 4) 多模态：仅带“最近客户消息”的图片，减少噪音（第三个参数 false）描述的图片不携带
    const mm = buildMultimodalUserContent(userPrompt, state, false);

    try {
      const resp = await fastStructured.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: mm },
      ]);
      shouldSearch = resp.action === "NEED_SEARCH";
    } catch (error) {
      logError("ragNode intentAnalysis: ", error);
      // 回退策略：解析失败则用保守策略（默认需要检索）
      shouldSearch = true;
    }
  }
  if (shouldSearch) {
    const ragStartTime = Date.now(); // 记录 RAG 开始时间
    let queries: string[] = [];
    const moduleFilter = variables.currentTicket?.module;
    const chat = new ChatOpenAI({
      apiKey: config.generateSearchQueriesLLM?.apiKey || DEFAULT_API_KEY,
      model: config.generateSearchQueriesLLM?.model || DEFAULT_MODEL,
      configuration: {
        baseURL: config.generateSearchQueriesLLM?.baseURL || DEFAULT_BASE_URL,
      },
    });
    // 1) 系统提示词：职责与输出结构
    const systemPrompt = await renderLiquidTemplate(
      config.generateSearchQueriesSystemPrompt,
      variables,
    );

    // 2) 用户提示：提供必要上下文
    const userPrompt = await renderLiquidTemplate(
      config.generateSearchQueriesUserPrompt,
      variables,
    );

    // 3) 结构化输出 schema
    const fastStructured = chat.withStructuredOutput(qsSchema);

    // 4) 多模态：附带工单描述图与最近客户消息的图片
    const mm = buildMultimodalUserContent(userPrompt, state);

    try {
      const out = await fastStructured.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: mm },
      ]);
      queries = Array.from(new Set(out.queries.map((q) => sanitizeQuery(q))))
        .filter(Boolean)
        .slice(0, 3);
    } catch (error) {
      logError("generateSearchQueriesNode", error);
      // 回退：用原 user_query
      queries = [variables.lastCustomerMessage].filter(Boolean);
    }

    if (queries.length === 0) {
      const fallback =
        `${variables.ticketTitle} ${variables.ticketModule}`.trim();
      queries = [fallback];
    }

    // 更稳的 K 分配
    const numQ = Math.max(1, queries.length);
    const BASE_K = 6;
    const perQueryK = Math.max(BASE_K, Math.ceil((BASE_K * 2) / numQ));

    // 超时包装器：避免慢查询阻塞整个流程
    const SEARCH_TIMEOUT = 20000; // 20秒超时
    const searchWithTimeout = (
      query: string,
      k: number,
      filters?: { module?: string },
    ): Promise<SearchHit[]> => {
      let timeoutId: NodeJS.Timeout | null = null;

      const searchPromise = store.search({
        query,
        k,
        filters,
      });

      const timeoutPromise = new Promise<SearchHit[]>((resolve) => {
        timeoutId = setTimeout(() => {
          logError(`Search timeout for query: ${query}`);
          resolve([]); // 超时返回空数组，不阻塞其他查询
        }, SEARCH_TIMEOUT);
      });

      // 使用 Promise.race，但在完成后清理 timer
      return Promise.race([searchPromise, timeoutPromise]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      });
    };

    // 多查询并行检索，使用 allSettled 确保部分失败不影响整体
    const searchResults = await Promise.allSettled(
      queries.map((q) =>
        searchWithTimeout(
          q,
          perQueryK,
          moduleFilter ? { module: moduleFilter } : undefined,
        ),
      ),
    );

    // 收集成功的结果
    const results: SearchHit[][] = [];
    for (const result of searchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        logError("Search query failed:", result.reason);
      }
    }

    // 如果所有查询都失败，使用原始消息作为回退
    if (results.length === 0 && queries.length > 0) {
      logError("All search queries failed, using fallback query");
      try {
        const fallbackResult = await searchWithTimeout(
          variables.lastCustomerMessage,
          BASE_K,
          moduleFilter ? { module: moduleFilter } : undefined,
        );
        results.push(fallbackResult);
      } catch (fallbackError) {
        logError("Fallback search also failed:", fallbackError);
        // 彻底失败，返回空结果
        return { retrievedContext: [] };
      }
    }

    // 合并并对"摘要"轻微加分（优先召回 chunk_id=0 / metadata.is_summary）
    // 同时记录多查询命中次数，作为相关性信号
    const merged = new Map<
      string,
      SearchHit & { finalScore: number; hitCount: number; maxBaseScore: number }
    >();
    for (const list of results) {
      for (const hit of list) {
        const base = Number(hit.score ?? 0);
        const isSummary =
          (hasSummaryFlag(hit.metadata) && hit.metadata.is_summary === true) ||
          hit.chunk_id === 0;
        const summaryBonus = isSummary ? 0.02 : 0;
        const currentScore = base + summaryBonus;

        const prev = merged.get(hit.id);
        if (prev) {
          // 多次命中：更新最高基础分
          const newMaxBaseScore = Math.max(prev.maxBaseScore, currentScore);

          // 基于最高分决定加分策略（而非当前分）
          // 这样确保了无论命中顺序如何，最终得分一致
          const multiHitBonus = newMaxBaseScore > 0.7 ? 0.03 : 0.01;

          // 最终得分 = 最高基础分 + 累积加分
          prev.finalScore = newMaxBaseScore + multiHitBonus * prev.hitCount;
          prev.maxBaseScore = newMaxBaseScore;
          prev.hitCount = prev.hitCount + 1;
        } else {
          // 首次命中
          merged.set(hit.id, {
            ...hit,
            finalScore: currentScore,
            hitCount: 1,
            maxBaseScore: currentScore,
          });
        }
      }
    }

    const sorted: Array<SearchHit & { finalScore: number }> = Array.from(
      merged.values(),
    ).sort((a, b) => b.finalScore - a.finalScore);

    // 多样性约束
    const MAX_PER_SOURCE = 2;
    const TOPN_BEFORE_EXPAND = 6;
    const perSourceCount = new Map<string, number>();
    const top: Array<SearchHit & { finalScore: number }> = [];

    for (const h of sorted) {
      const key = `${h.source_type}:${h.source_id ?? ""}`;
      const cnt = perSourceCount.get(key) ?? 0;
      if (cnt >= MAX_PER_SOURCE) continue;
      top.push(h);
      perSourceCount.set(key, cnt + 1);
      if (top.length >= TOPN_BEFORE_EXPAND) break;
    }

    // 如果未达到目标数量，继续添加（使用 Set 避免 O(n²) 查找）
    if (top.length < TOPN_BEFORE_EXPAND) {
      const topIds = new Set(top.map((h) => h.id));
      for (const h of sorted) {
        if (topIds.has(h.id)) continue;
        top.push(h);
        topIds.add(h.id);
        if (top.length >= TOPN_BEFORE_EXPAND) break;
      }
    }

    const trimmedTop: SearchHit[] = top.map(
      ({ finalScore: _fs, ...rest }) => rest,
    );

    const expandedTop = await expandDialogResults(trimmedTop, store);
    retrievedContext = expandedTop;

    // 在合并去重后，统一更新访问次数，确保每个 chunk 在一次对话中只计数一次
    // 使用 trimmedTop（去重后的最终结果）而非 expandedTop
    const finalChunkIds = Array.from(
      new Set(trimmedTop.map((hit) => hit.id)),
    ).filter(Boolean);

    if (finalChunkIds.length > 0) {
      try {
        const ragDuration = Date.now() - ragStartTime; // 计算 RAG 耗时
        await store.updateAccessCount(finalChunkIds, {
          userQuery: variables.lastCustomerMessage,
          aiGenerateQueries: queries,
          ticketId: state.currentTicket?.id,
          ticketModule: state.currentTicket?.module,
          ragDuration,
        });
      } catch (error) {
        logError("ragNode updateAccessCount: ", error);
        // 统计失败不影响主流程
      }
    }
  }

  return { retrievedContext };
}

async function expandDialogResults(
  hits: SearchHit[],
  store: VectorStore,
): Promise<SearchHit[]> {
  const DIALOG_SOURCES = new Set([
    "favorited_conversation",
    "historical_ticket",
  ]);
  const bySource = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const key = `${h.source_type}:${h.source_id ?? ""}`;
    const list = bySource.get(key) ?? [];
    list.push(h);
    bySource.set(key, list);
  }

  const expanded: SearchHit[] = [];
  for (const [key, list] of bySource.entries()) {
    const [source_typeRaw, source_idRaw] = key.split(":");
    const source_type: string = source_typeRaw ?? "";
    const source_id: string = source_idRaw ?? "";
    const isDialog = DIALOG_SOURCES.has(source_type);
    if (!isDialog) {
      const first = list[0];
      if (first) expanded.push(first);
      continue;
    }

    const hasSummary = list.find((x) => x.chunk_id === 0);
    if (hasSummary) {
      expanded.push(hasSummary);
      try {
        if (typeof store.getNeighbors === "function") {
          // 扩大窗口，获取对话开头的几个 chunk
          const neighbors = await store.getNeighbors({
            source_type: source_type || "",
            source_id: source_id || "",
            chunk_id: 0,
            window: 2, // 从 1 增加到 2，获取 chunk 1-2
          });
          // 按相关度排序，选择最相关的邻居 chunk
          const sortedNeighbors = neighbors
            .filter((n: SearchHit) => n.chunk_id !== 0)
            .sort((a, b) => (b.score || 0) - (a.score || 0));

          // 最多添加 2 个邻居 chunk
          for (let i = 0; i < Math.min(2, sortedNeighbors.length); i++) {
            const neighbor = sortedNeighbors[i];
            if (neighbor) expanded.push(neighbor);
          }
        }
      } catch {
        void 0;
      }
      continue;
    }

    const center = list[0];
    if (!center) {
      continue;
    }
    if (center.chunk_id == null || center.source_id == null) {
      expanded.push(center);
      continue;
    }

    let group: SearchHit[] = [center];
    try {
      if (typeof store.getNeighbors === "function") {
        const neighbors = await store.getNeighbors({
          source_type: source_type || "",
          source_id: center.source_id || source_id || "",
          chunk_id: center.chunk_id!,
          window: 1,
        });
        const uniq = new Map<string, SearchHit>();
        for (const n of neighbors) uniq.set(n.id, n);
        group = [
          ...([center.chunk_id! - 1, center.chunk_id!, center.chunk_id! + 1]
            .map((cid) =>
              Array.from(uniq.values()).find((x) => x.chunk_id === cid),
            )
            .filter(Boolean) as SearchHit[]),
        ];
      } else {
        const ids = new Map<number, SearchHit>();
        for (const h of list) if (h.chunk_id != null) ids.set(h.chunk_id, h);
        group = [
          ids.get(center.chunk_id - 1) as SearchHit | undefined,
          center,
          ids.get(center.chunk_id + 1) as SearchHit | undefined,
        ].filter(Boolean) as SearchHit[];
      }
    } catch {
      group = [center];
    }

    for (const g of group) expanded.push(g);
  }

  const uniq = new Map<string, SearchHit>();
  for (const h of expanded) uniq.set(h.id, h);
  return Array.from(uniq.values()).slice(0, 7);
}
