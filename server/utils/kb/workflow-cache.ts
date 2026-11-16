// ============================================================================
// 【快速上手区】
// ============================================================================
/*
【文件作用】
管理 AI 工作流的编译缓存和执行，避免重复编译工作流（LangGraph 编译很慢）
核心数据来自两个 DB 表：
  - workflow 表：存储工作流定义（nodes/edges 的 JSON 配置）
  - aiRoleConfig 表：存储 AI 角色配置（scope -> workflowId 映射）

【核心入口函数】
1. workflowCache.initialize() - 启动时调用，从 DB 加载配置并编译工作流
2. getAIResponse(ticket) - 获取 AI 的完整回复（阻塞式，带重试）
3. streamAIResponse(ticket) - 流式获取 AI 回复（用于实时显示）

【关键数据对象】
1. WorkflowCache.workflowCache: Map<workflowId, CompiledStateGraph>
   → 第一层缓存：已编译的工作流对象（避免重复编译）

2. WorkflowCache.scopeCache: Map<scope, {aiUserId, workflowId}>
   → 第二层缓存：业务 scope 到 workflow 的映射（如 "default_all" -> workflowId）

3. WorkflowState: 工作流运行时的状态对象
   → 包含：messages（历史消息）、currentTicket（当前工单）、response（AI 回复）等
   → 来自 workflow-node/workflow-tools.ts 的类型定义

【主要副作用】
- DB 读取：启动时从 workflow/aiRoleConfig 表读取配置
- 内存缓存：两层 Map 结构存储编译后的工作流
- 日志：logInfo/logError 记录缓存状态和错误
- 网络：invoke() 时可能调用外部 LLM API（LangGraph 内部处理）

【改动导航】
想改 "X"？优先看这里：
  1. 修改缓存策略 → 第 133-223 行（initialize 方法：两层缓存构建逻辑）
  2. 修改 AI 回复重试逻辑 → 第 753-769 行（while 循环：最多重试 3 次）
  3. 修改工作流选择逻辑 → 第 700-710 行（getWorkflow 优先匹配 module，fallback 到 default_all）
  4. 添加新的缓存查询方法 → 第 247-453 行（各种 get 方法：getAiUserId/getWorkflowId 等）
*/
// ============================================================================

import { type CompiledStateGraph } from "@langchain/langgraph";
import { eq, asc } from "drizzle-orm";
import * as schema from "@/db/schema.ts";
import { connectDB } from "../tools";
import { type WorkflowState, AgentMessage } from "./workflow-node/workflow-tools.ts";
import type { RagTrace } from "./types.ts";
import { logError, logInfo } from "@/utils/log.ts";
import { WorkflowBuilder } from "./workflow-builder.ts";
import { convertToMultimodalMessage, sleep } from "./tools";
import { basicUserCols } from "../../api/queryParams.ts";
import { type JSONContentZod } from "../types";
import { type JSONContent } from "@tiptap/core";

/**
 * ============================================================================
 * 【类名】WorkflowCache - 工作流缓存管理类
 * ============================================================================
 *
 * 【用途】
 * 管理 AI 工作流（LangGraph StateGraph）的编译缓存，避免每次请求都重新编译
 * 核心痛点：LangGraph 编译很慢，需要缓存；多个业务 scope 可能共享同一个 workflow
 *
 * 【数据结构：两层缓存】
 * 1) workflowCache: Map<workflowId, CompiledStateGraph>
 *    → 第一层：workflowId 到编译后工作流的映射
 *    → 证据：第 90-93 行的 Map 定义，第 160-186 行的编译逻辑
 *
 * 2) scopeCache: Map<scope, {aiUserId, workflowId}>
 *    → 第二层：业务 scope 到 workflow 的映射
 *    → 证据：第 97-103 行的 Map 定义，第 190-218 行的映射逻辑
 *
 * 【调用关系】
 * - 上游：应用启动时调用 workflowCache.initialize()（见 server/index.ts 的启动逻辑）
 * - 下游：getAIResponse/streamAIResponse 调用 getWorkflow() 获取编译后的工作流
 *
 * 【核心流程】
 * 1) initialize() 从 DB 加载 workflow 和 aiRoleConfig 表
 * 2) 编译所有 workflow（第一层缓存）
 * 3) 建立 scope -> workflowId 映射（第二层缓存）
 * 4) 业务代码通过 scope 获取 workflow，然后 invoke() 执行
 *
 * 【错误与边界】
 * - 如果 workflow 编译失败：记录错误日志但跳过（不影响其他 workflow）
 * - 如果找不到 workflow：getWorkflow() 返回 null，调用方需处理
 * - 如果找不到 fallback（default_all）：记录 CRITICAL 错误日志
 */
export class WorkflowCache {
  // 第一层缓存：workflowId -> 编译后的工作流
  // 一个 workflow 只编译一次，避免重复编译和内存浪费
  private workflowCache: Map<
    string,
    CompiledStateGraph<WorkflowState, Partial<WorkflowState>>
  > = new Map();

  // 第二层缓存：scope -> { aiUserId, workflowId }
  // 用于快速根据 scope 查找对应的 AI 用户和工作流
  private scopeCache: Map<
    string,
    {
      aiUserId: number;
      workflowId: string;
    }
  > = new Map();

  /**
   * ============================================================================
   * 【方法】initialize() - 初始化两层缓存
   * ============================================================================
   *
   * 【用途】
   * 从 DB 加载配置并编译所有 workflow，建立两层缓存结构
   * 上游：应用启动时调用（见 server/index.ts）
   *
   * 【核心流程】
   * 1) 查询 DB：workflow 表（所有工作流）+ aiRoleConfig 表（isActive=true 的配置）
   * 2) 清空旧缓存：clear() 两个 Map
   * 3) 构建第一层缓存：遍历所有 workflow，用 WorkflowBuilder.build() 编译并存入 workflowCache
   * 4) 构建第二层缓存：遍历激活的 aiRoleConfig，建立 scope -> {aiUserId, workflowId} 映射
   *
   * 【数据快照】
   * 入参（无）
   * 出参（无，副作用是填充两个 Map）
   *
   * DB 查询结果示例（证据来自 schema）：
   * - workflow: {id: string, name: string, nodes: JSON, edges: JSON}
   * - aiRoleConfig: {id: number, scope: string, aiUserId: number, workflowId: string, isActive: boolean}
   *
   * 【错误与边界】
   * - workflow 编译失败：catch 错误，logError，跳过该 workflow（不影响其他）
   * - scope 映射失败：catch 错误，logError，跳过该 config
   * - 返回值：void（失败不抛异常，只记录日志）
   */
  async initialize(): Promise<void> {
    logInfo("[WorkflowCache] Initializing workflow cache...");

    const db = connectDB();

    // 1) 查询所有工作流用于第一层缓存
    // 证据：db.query.workflow.findMany() 来自 drizzle-orm 的查询 API
    const allWorkflows = await db.query.workflow.findMany();
    logInfo(`[WorkflowCache] Found ${allWorkflows.length} total workflows`);

    // 2) 查询激活的 AI 角色配置用于第二层缓存
    // 约束：只加载 isActive=true 的配置，避免未激活的配置进入缓存
    const activeConfigs = await db.query.aiRoleConfig.findMany({
      where: eq(schema.aiRoleConfig.isActive, true),
      with: {
        workflow: true,
      },
    });
    logInfo(
      `[WorkflowCache] Found ${activeConfigs.length} active AI role configs`,
    );

    // 3) 清空两层缓存
    // 为什么清空：支持 refresh() 重新初始化，避免旧配置残留
    this.workflowCache.clear();
    this.scopeCache.clear();

    // 4) 第一层缓存：编译所有工作流（不仅仅是激活的）
    // 为什么编译所有：不同的 scope 可能共享同一个 workflow，避免重复编译
    for (const workflow of allWorkflows) {
      try {
        if (!workflow.nodes || !workflow.edges) {
          logInfo(
            `[WorkflowCache] Skipping workflow ${workflow.id} (${workflow.name}) - invalid nodes or edges`,
          );
          continue;
        }

        // 翻译：new WorkflowBuilder(workflow) 创建构建器，.build() 编译为 LangGraph StateGraph
        const builder = new WorkflowBuilder(workflow);
        const compiledWorkflow = builder.build();
        this.workflowCache.set(workflow.id, compiledWorkflow);

        logInfo(
          `[WorkflowCache] Compiled workflow: ${workflow.id} (${workflow.name})`,
        );
      } catch (error) {
        // 容错：单个 workflow 编译失败不影响其他 workflow
        logError(
          `[WorkflowCache] Failed to build workflow ${workflow.id}`,
          error,
        );
      }
    }

    // 5) 第二层缓存：只为激活的配置建立 scope -> { aiUserId, workflowId } 映射
    // 为什么只为激活的配置：未激活的配置不应提供服务
    for (const config of activeConfigs) {
      try {
        if (
          !config.workflow ||
          !config.workflowId ||
          !config.workflow?.nodes ||
          !config.workflow?.edges
        ) {
          logInfo(
            `[WorkflowCache] Skipping config ${config.id} (scope: ${config.scope}) - no workflow bound or workflow is invalid`,
          );
          continue;
        }

        this.scopeCache.set(config.scope, {
          aiUserId: config.aiUserId,
          workflowId: config.workflowId,
        });

        logInfo(
          `[WorkflowCache] Mapped scope: ${config.scope} -> workflowId: ${config.workflowId}, aiUserId: ${config.aiUserId}`,
        );
      } catch (error) {
        logError(
          `[WorkflowCache] Failed to map scope for config ${config.id}`,
          error,
        );
      }
    }

    logInfo(
      `[WorkflowCache] Initialization complete. Compiled ${this.workflowCache.size} unique workflows for ${this.scopeCache.size} active scopes`,
    );
  }

  /**
   * 更新缓存
   *
   * 重新从数据库加载配置并重建缓存
   * 适用场景：
   * - aiRoleConfig 表发生变化（新增、删除、修改配置）
   * - workflow 表发生变化（工作流定义被修改）
   * - isActive 状态被切换
   *
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // 当管理员更新了 AI 角色配置后
   * await workflowCache.refresh();
   * ```
   */
  async refresh(): Promise<void> {
    logInfo("[WorkflowCache] Refreshing workflow cache...");
    await this.initialize();
  }

  /**
   * 根据 scope 获取编译后的工作流
   *
   * @param {string} scope - AI 角色回答范围（例如: "default_all", "tech_support", "sales"）
   * @returns {CompiledStateGraph<WorkflowState, Partial<WorkflowState>> | null}
   *          编译后的工作流，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const workflow = workflowCache.getWorkflow("default_all");
   * if (workflow) {
   *   const result = await workflow.invoke(initialState);
   *   console.log(result.response);
   * } else {
   *   console.error("Workflow not found");
   * }
   * ```
   */
  getWorkflow(
    scope: string,
  ): CompiledStateGraph<WorkflowState, Partial<WorkflowState>> | null {
    // 先从第二层缓存获取 workflowId
    const scopeInfo = this.scopeCache.get(scope);
    if (!scopeInfo) {
      logInfo(
        `[WorkflowCache] No workflow found for scope: ${scope}. Available scopes: ${Array.from(this.scopeCache.keys()).join(", ")}`,
      );
      return null;
    }

    // 再从第一层缓存获取编译后的工作流
    const workflow = this.workflowCache.get(scopeInfo.workflowId);
    if (!workflow) {
      logError(
        `[WorkflowCache] CRITICAL: Workflow ${scopeInfo.workflowId} not found in workflowCache for scope: ${scope}`,
      );
      return null;
    }

    return workflow;
  }

  /**
   * 根据 workflow ID 获取编译后的工作流
   *
   * @param {string} workflowId - 工作流 ID
   * @returns {CompiledStateGraph<WorkflowState, Partial<WorkflowState>> | null}
   *          编译后的工作流，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const workflow = workflowCache.getWorkflowById("wf-123");
   * if (workflow) {
   *   const result = await workflow.invoke(initialState);
   *   console.log(result.response);
   * } else {
   *   console.error("Workflow not found");
   * }
   * ```
   */
  getWorkflowById(
    workflowId: string | undefined,
  ): CompiledStateGraph<WorkflowState, Partial<WorkflowState>> | null {
    if (!workflowId) {
      logInfo(`[WorkflowCache] No workflowId provided`);
      return null;
    }
    const workflow = this.workflowCache.get(workflowId);
    if (!workflow) {
      logInfo(
        `[WorkflowCache] No workflow found for workflowId: ${workflowId}. Available workflowIds: ${Array.from(this.workflowCache.keys()).join(", ")}`,
      );
      return null;
    }
    return workflow;
  }

  getFallbackWorkflow(): CompiledStateGraph<
    WorkflowState,
    Partial<WorkflowState>
  > | null {
    const fallback = this.getWorkflow("default_all");
    if (!fallback) {
      logError(
        `[WorkflowCache] CRITICAL: Fallback workflow (default_all) not found. ` +
          `Available scopes: ${this.getScopes().join(", ") || "none"}`,
      );
    }
    return fallback;
  }

  /**
   * 获取 default_all scope 对应的 AI 用户 ID
   *
   * @returns {number | null} AI 用户 ID，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const aiUserId = workflowCache.getFallbackAiUserId();
   * if (aiUserId) {
   *   console.log(`Fallback AI User ID: ${aiUserId}`);
   * } else {
   *   console.error("Fallback AI user ID not found");
   * }
   * ```
   */
  getFallbackAiUserId(): number | null {
    const aiUserId = this.getAiUserId("default_all");
    if (!aiUserId) {
      logError(
        `[WorkflowCache] CRITICAL: Fallback AI user ID (default_all) not found. ` +
          `Available scopes: ${this.getScopes().join(", ") || "none"}`,
      );
    }
    return aiUserId;
  }

  /**
   * 根据 scope 获取对应的 AI 用户 ID
   *
   * @param {string} scope - AI 角色回答范围
   * @returns {number | null} AI 用户 ID，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const aiUserId = workflowCache.getAiUserId("default_all");
   * if (aiUserId) {
   *   console.log(`AI User ID: ${aiUserId}`);
   * }
   * ```
   */
  getAiUserId(scope: string): number | null {
    const scopeInfo = this.scopeCache.get(scope);
    return scopeInfo?.aiUserId ?? null;
  }

  /**
   * 根据 scope 获取对应的 workflow ID
   *
   * @param {string} scope - AI 角色回答范围
   * @returns {string | null} workflow ID，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const workflowId = workflowCache.getWorkflowId("default_all");
   * if (workflowId) {
   *   console.log(`Workflow ID: ${workflowId}`);
   * }
   * ```
   */
  getWorkflowId(scope: string): string | null {
    const scopeInfo = this.scopeCache.get(scope);
    return scopeInfo?.workflowId ?? null;
  }

  /**
   * 获取所有已缓存的 scope
   *
   * @returns {string[]} scope 列表
   *
   * @example
   * ```typescript
   * const scopes = workflowCache.getScopes();
   * console.log(`Available scopes: ${scopes.join(", ")}`);
   * // 输出: Available scopes: default_all, tech_support, sales
   * ```
   */
  getScopes(): string[] {
    return Array.from(this.scopeCache.keys());
  }

  /**
   * 获取所有已缓存的 workflow ID
   *
   * @returns {string[]} workflow ID 列表
   *
   * @example
   * ```typescript
   * const workflowIds = workflowCache.getWorkflowIds();
   * console.log(`Available workflowIds: ${workflowIds.join(", ")}`);
   * ```
   */
  getWorkflowIds(): string[] {
    return Array.from(this.workflowCache.keys());
  }

  /**
   * 根据 workflowId 获取所有使用该 workflow 的 scope
   *
   * @param {string} workflowId - 工作流 ID
   * @returns {string[]} 使用该 workflow 的 scope 列表
   *
   * @example
   * ```typescript
   * const scopes = workflowCache.getScopesByWorkflowId("wf-123");
   * console.log(`Scopes using workflow wf-123: ${scopes.join(", ")}`);
   * ```
   */
  getScopesByWorkflowId(workflowId: string): string[] {
    const scopes: string[] = [];
    for (const [scope, info] of this.scopeCache.entries()) {
      if (info.workflowId === workflowId) {
        scopes.push(scope);
      }
    }
    return scopes;
  }

  /**
   * 检查指定 scope 是否有缓存
   *
   * @param {string} scope - AI 角色回答范围
   * @returns {boolean} 是否存在缓存
   *
   * @example
   * ```typescript
   * if (workflowCache.has("default_all")) {
   *   const workflow = workflowCache.getWorkflow("default_all");
   * } else {
   *   await workflowCache.initialize();
   * }
   * ```
   */
  has(scope: string): boolean {
    return this.scopeCache.has(scope);
  }

  /**
   * 检查指定 workflow ID 是否有缓存
   *
   * @param {string} workflowId - 工作流 ID
   * @returns {boolean} 是否存在缓存
   *
   * @example
   * ```typescript
   * if (workflowCache.hasWorkflow("wf-123")) {
   *   const workflow = workflowCache.getWorkflowById("wf-123");
   * }
   * ```
   */
  hasWorkflow(workflowId: string): boolean {
    return this.workflowCache.has(workflowId);
  }

  /**
   * 获取 scope 缓存的大小
   *
   * @returns {number} 缓存中的 scope 数量
   *
   * @example
   * ```typescript
   * console.log(`Cached scopes: ${workflowCache.scopeSize()}`);
   * ```
   */
  scopeSize(): number {
    return this.scopeCache.size;
  }

  /**
   * 获取 workflow 缓存的大小
   *
   * @returns {number} 缓存中的唯一 workflow 数量
   *
   * @example
   * ```typescript
   * console.log(`Cached unique workflows: ${workflowCache.workflowSize()}`);
   * ```
   */
  workflowSize(): number {
    return this.workflowCache.size;
  }

  /**
   * 获取缓存的大小（兼容旧 API）
   *
   * @returns {number} 缓存中的 scope 数量
   * @deprecated 使用 scopeSize() 或 workflowSize() 代替
   *
   * @example
   * ```typescript
   * console.log(`Cached scopes: ${workflowCache.size()}`);
   * ```
   */
  size(): number {
    return this.scopeCache.size;
  }

  /**
   * 清空所有缓存
   *
   * 用于测试或需要完全重置缓存的场景
   * 注意：清空后需要调用 initialize() 重新加载
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * workflowCache.clear();
   * await workflowCache.initialize();
   * ```
   */
  clear(): void {
    logInfo("[WorkflowCache] Clearing all cached workflows");
    this.workflowCache.clear();
    this.scopeCache.clear();
  }
}

/**
 * 全局工作流缓存单例实例
 *
 * 在应用启动时需要调用 initialize() 进行初始化
 *
 * @example
 * ```typescript
 * // 在应用启动时
 * await workflowCache.initialize();
 *
 * // 在业务代码中使用
 * const workflow = workflowCache.getWorkflow("default_all");
 * ```
 */
export const workflowCache = new WorkflowCache();

// 定义消息查询结果的类型（基于 schema 和查询配置）
type MessageWithSender = Pick<
  | typeof schema.workflowTestMessage.$inferSelect
  | typeof schema.chatMessages.$inferSelect,
  "id" | "senderId" | "content" | "createdAt"
> & {
  sender: Pick<
    typeof schema.users.$inferSelect,
    "id" | "name" | "nickname" | "avatar" | "role"
  > | null;
};

/**
 * ============================================================================
 * 【函数】getAIResponse() - 获取 AI 的完整回复（阻塞式，带重试）
 * ============================================================================
 *
 * 【用途】
 * 根据工单信息调用 AI 工作流，返回 AI 的文本回复
 * 上游：聊天消息 API（/api/chat）调用此函数生成 AI 回复
 * 下游：调用 workflow.invoke() 执行 LangGraph 工作流
 *
 * 【核心流程】
 * 1) 从 DB 查询工单的历史消息（chatMessages 或 workflowTestMessage 表）
 * 2) 转换消息格式：TipTap JSON -> AgentMessage（多模态格式）
 * 3) 选择工作流：根据 ticket.module 或 workflowId 从缓存获取
 * 4) 构造初始状态：WorkflowState（包含 history、currentTicket 等）
 * 5) 调用 workflow.invoke()：执行工作流，最多重试 3 次（如果返回空字符串）
 *
 * 【参数说明】
 * @param ticket - 工单对象（部分字段）
 *   → 通常来自 DB 查询结果（tickets 表）
 *   → 最小字段示例：{id: "T123", title: "问题", module: "default_all"}
 *
 * @param isWorkflowTest - 是否是工作流测试模式
 *   → false（默认）：正常工单，查询 chatMessages 表
 *   → true：测试模式，查询 workflowTestMessage 表
 *
 * @param workflowId - 工作流 ID（可选）
 *   → 仅在 isWorkflowTest=true 时使用
 *   → 如果不传，会使用 default_all workflow
 *
 * 【数据快照】
 * 返回值：string（AI 的文本回复）
 *   示例："您好，我已经收到您的问题，正在为您处理..."
 *
 * WorkflowState 初始状态示例：
 *   {
 *     messages: [{role: "customer", content: "...", createdAt: "..."}],
 *     currentTicket: {id: "T123", title: "...", module: "default_all"},
 *     response: "",  // AI 回复会被写入这里
 *     sentimentLabel: "NEUTRAL",
 *     handoffRequired: false
 *   }
 *
 * 【错误与边界】
 * - 找不到 workflow：抛出 Error（包含可用的 scopes 列表）
 * - workflow.invoke() 失败：logError，重试最多 3 次
 * - Empty or whitespace-only responses: retry up to 3 times, then throw.
 */
export async function getAIResponse(
  ticket: Pick<
    typeof schema.tickets.$inferSelect,
    "id" | "title" | "description" | "module" | "category"
  >,
  isWorkflowTest: boolean = false,
  workflowId?: string,
  runtimeVariables?: Record<string, unknown>,
): Promise<{ response: string; ragTrace?: RagTrace }> {
  const db = connectDB();

  // 1) 查询该工单的对话（带 sender 用户信息），按时间升序
  // 证据：isWorkflowTest 决定查哪个表（workflowTestMessage 或 chatMessages）
  let msgs: MessageWithSender[];
  if (isWorkflowTest) {
    msgs = await db.query.workflowTestMessage.findMany({
      where: (m, { eq }) => eq(m.testTicketId, ticket.id),
      orderBy: [asc(schema.workflowTestMessage.createdAt)],
      columns: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
      with: {
        sender: basicUserCols,
      },
    });
  } else {
    // 翻译：and(eq(m.ticketId, ticket.id), eq(m.isInternal, false)) 过滤出该工单的非内部消息
    msgs = await db.query.chatMessages.findMany({
      where: (m, { and, eq }) =>
        and(eq(m.ticketId, ticket.id), eq(m.isInternal, false)),
      orderBy: [asc(schema.chatMessages.createdAt)],
      columns: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
      with: {
        sender: basicUserCols,
      },
    });
  }

  // 2) 转换消息格式：TipTap JSON -> AgentMessage（多模态格式）
  // 为什么转换：LangGraph 工作流期望的消息格式是 AgentMessage（role + multimodal content）
  const history: AgentMessage[] = [];
  for (const m of msgs) {
    if (!m) continue;
    let role = m.sender?.role ?? "user";
    // 翻译：isWorkflowTest && role !== "ai" 如果是测试模式且非 AI，强制改为 customer
    // 为什么强制改：测试环境可能没有真实的 customer 角色，统一改为 customer 便于测试
    if (isWorkflowTest && role !== "ai") {
      role = "customer";
    }
    const multimodalContent = convertToMultimodalMessage(
      m.content as JSONContentZod,
    );
    history.push({ role, content: multimodalContent, createdAt: m.createdAt });
  }
  // 翻译：sort((a, b) => at - bt) 按时间升序排序（早的消息在前）
  // 为什么排序：DB 查询已有 orderBy，这里双重保险确保消息顺序正确
  history.sort((a: AgentMessage, b: AgentMessage) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });

  // 3) 选择工作流：根据 ticket.module 或 workflowId 从缓存获取
  let workflow;
  if (isWorkflowTest) {
    workflow = workflowCache.getWorkflowById(workflowId);
  } else {
    // 翻译：?? 是空值合并操作符，如果左侧为 null/undefined，返回右侧
    // 优先级：ticket.module（精确匹配）?? getFallbackWorkflow（default_all）
    workflow =
      workflowCache.getWorkflow(ticket.module) ??
      workflowCache.getFallbackWorkflow();
  }

  if (!workflow) {
    const availableScopes = workflowCache.getScopes();
    throw new Error(
      `No workflow available for scope: ${ticket.module}. ` +
        `Fallback workflow (default_all) is also missing. ` +
        `Available scopes: ${availableScopes.join(", ") || "none"}`,
    );
  }

  // 4) 构造初始状态：WorkflowState（包含 history、currentTicket 等）
  // 证据：WorkflowState 类型定义来自 workflow-node/workflow-tools.ts
  const initialState: WorkflowState = {
    messages: history,
    currentTicket: ticket
      ? {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description as JSONContentZod | undefined,
          module: ticket.module ?? undefined,
          category: ticket.category ?? undefined,
        }
      : undefined,
    userQuery: "",
    sentimentLabel: "NEUTRAL",
    handoffRequired: false,
    handoffReason: "",
    handoffPriority: "P2",
    searchQueries: [],
    retrievedContext: [],
    ragTrace: undefined,
    response: "",
    proposeEscalation: false,
    escalationReason: "",
    variables: runtimeVariables ? { ...runtimeVariables } : {},
  };

  // 5) 调用 workflow.invoke()：执行工作流，最多重试 3 次（如果返回空字符串）
  // 证据：LangGraph 的 CompiledStateGraph.invoke() 方法执行工作流
  // 为什么重试：LLM 可能返回空字符串（网络问题、API 限流等），重试提高成功率
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = (await workflow.invoke(initialState)) as WorkflowState;
      const response = result.response ?? "";
      if (typeof response === "string" && response.trim() !== "") {
        return { response, ragTrace: result.ragTrace };
      }
    } catch (e) {
      logError(String(e));
    }

    attempt++;
    if (attempt <= maxRetries) {
      // 翻译：await sleep(300) 等待 300 毫秒（避免频繁重试触发 API 限流）
      await sleep(300);
    }
  }

  throw new Error("AI response generation failed after retries");
}

/**
 * ============================================================================
 * 【函数】streamAIResponse() - 流式获取 AI 回复（用于实时显示）
 * ============================================================================
 *
 * 【用途】
 * 根据工单信息调用 AI 工作流，通过 Generator 逐步返回 AI 回复
 * 与 getAIResponse 的区别：使用 stream() 而不是 invoke()，可以实时输出 AI 生成的文本
 * 上游：聊天消息 API（/api/chat）调用此函数实现打字机效果
 * 下游：调用 workflow.stream() 执行 LangGraph 工作流的流式模式
 *
 * 【核心流程】
 * 1) 从 DB 查询工单的历史消息（与 getAIResponse 相同）
 * 2) 转换消息格式：TipTap JSON -> AgentMessage（与 getAIResponse 相同）
 * 3) 选择工作流：根据 ticket.module 或 workflowId 从缓存获取（与 getAIResponse 相同）
 * 4) 构造初始状态：WorkflowState（与 getAIResponse 相同）
 * 5) 调用 workflow.stream()：执行工作流，通过 for await 循环逐步 yield response
 *
 * 【参数说明】
 * @param ticket - 工单对象（部分字段）
 *   → 与 getAIResponse 相同
 *
 * @param isWorkflowTest - 是否是工作流测试模式
 *   → 与 getAIResponse 相同
 *
 * @param workflowId - 工作流 ID（可选）
 *   → 与 getAIResponse 相同
 *
 * 【数据快照】
 * 返回值：AsyncGenerator<string, void, unknown>
 *   → 每次 yield 一段 AI 生成的文本（可能不完整）
 *   → 示例：yield "您好"，yield "，我已经"，yield "收到您的消息"
 *
 * 使用示例：
 *   for await (const chunk of streamAIResponse(ticket)) {
 *     console.log(chunk);  // 逐步输出：您好，我已经收到您的消息
 *   }
 *
 * 【错误与边界】
 * - 找不到 workflow：抛出 Error（与 getAIResponse 相同）
 * - workflow.stream() 失败：未捕获异常，会向上抛出
 * - BUG：目前会 yield 所有节点的 response，而不仅仅是 smart chat 节点（见第 931-941 行的注释）
 *
 * 【已知问题】
 * 代码中有注释"BUG: 应该只拿 smart chat 的 response"（第 931 行）
 * 当前实现会 yield 所有节点的 response，导致可能输出非 smart chat 节点的内容
 * 如何修复：检查 nodeId，只有当 nodeId 是 smart chat 节点时才 yield
 */
// 流式响应支持
export async function* streamAIResponse(
  ticket: Pick<
    typeof schema.tickets.$inferSelect,
    "id" | "title" | "description" | "module" | "category"
  >,
  isWorkflowTest: boolean = false,
  workflowId?: string,
) {
  const db = connectDB();
  // 查询该工单的对话（带 sender 用户信息），按时间升序
  let msgs: MessageWithSender[];
  if (isWorkflowTest) {
    msgs = await db.query.workflowTestMessage.findMany({
      where: (m, { eq }) => eq(m.testTicketId, ticket.id),
      orderBy: [asc(schema.workflowTestMessage.createdAt)],
      columns: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
      with: {
        sender: basicUserCols,
      },
    });
  } else {
    msgs = await db.query.chatMessages.findMany({
      where: (m, { and, eq }) =>
        and(eq(m.ticketId, ticket.id), eq(m.isInternal, false)),
      orderBy: [asc(schema.chatMessages.createdAt)],
      columns: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
      with: {
        sender: basicUserCols,
      },
    });
  }

  const history: AgentMessage[] = [];
  for (const m of msgs) {
    if (!m) continue;
    let role = m.sender?.role ?? "user";
    // 当 isWorkflowTest 为 true 时，所有非 ai 的 role 都改成 customer
    if (isWorkflowTest && role !== "ai") {
      role = "customer";
    }
    const multimodalContent = convertToMultimodalMessage(
      m.content as JSONContentZod,
    );
    history.push({ role, content: multimodalContent, createdAt: m.createdAt });
  }
  history.sort((a: AgentMessage, b: AgentMessage) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });

  let workflow;
  if (isWorkflowTest) {
    workflow = workflowCache.getWorkflowById(workflowId);
  } else {
    workflow =
      workflowCache.getWorkflow(ticket.module) ??
      workflowCache.getFallbackWorkflow();
  }

  if (!workflow) {
    const availableScopes = workflowCache.getScopes();
    throw new Error(
      `No workflow available for scope: ${ticket.module}. ` +
        `Fallback workflow (default_all) is also missing. ` +
        `Available scopes: ${availableScopes.join(", ") || "none"}`,
    );
  }

  // 准备初始状态
  const initialState: WorkflowState = {
    messages: history,
    currentTicket: ticket
      ? {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description as JSONContentZod | undefined,
          module: ticket.module ?? undefined,
          category: ticket.category ?? undefined,
        }
      : undefined,
    userQuery: "",
    sentimentLabel: "NEUTRAL",
    handoffRequired: false,
    handoffReason: "",
    handoffPriority: "P2",
    searchQueries: [],
    retrievedContext: [],
    ragTrace: undefined,
    response: "",
    proposeEscalation: false,
    escalationReason: "",
    variables: {},
  };

  // 使用 stream 方法进行流式处理
  const stream = await workflow.stream(initialState);

  // BUG: 应该只拿 smart chat 的 response
  for await (const chunk of stream) {
    // 不关心具体是哪个节点，只要有response就输出
    const updates = chunk as Record<string, any>;

    for (const [nodeId, update] of Object.entries(updates)) {
      if (update?.response) {
        yield update.response;
        break; // 假设每个chunk只有一个节点有response
      }
    }
  }

  // for await (const chunk of stream) {
  //   // 每个 chunk 包含节点名称和状态更新
  //   if (chunk.generateResponse?.response) {
  //     yield chunk.generateResponse.response;
  //   }
  // }
}

/**
 * 将 AI 回复的字符串转换成 TipTap JSONContent 格式
 *
 * 该函数将整个字符串作为一个段落，不做任何分割处理
 *
 * @param {string} aiResponse - AI 回复的字符串内容
 * @returns {JSONContent} TipTap JSONContent 对象
 *
 * @example
 * ```typescript
 * const response = "这是 AI 的完整回复内容。\n可能包含多行。";
 * const json = convertAIResponseToTipTapJSON(response);
 * // 返回: {
 * //   type: "doc",
 * //   content: [
 * //     { type: "paragraph", content: [{ type: "text", text: "这是 AI 的完整回复内容。\n可能包含多行。" }] }
 * //   ]
 * // }
 * ```
 */
export function convertAIResponseToTipTapJSON(aiResponse: string): JSONContent {
  // 如果是空字符串，返回空文档
  if (!aiResponse || aiResponse.trim() === "") {
    return {
      type: "doc",
      content: [],
    };
  }

  // 将整个字符串作为一个段落
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: aiResponse,
          },
        ],
      },
    ],
  };
}

// ============================================================================
// 【学习建议】
// ============================================================================
/*
【我最该从哪 3 个函数开始读】
1. initialize() - 第 133-223 行
   → 理解两层缓存的结构和构建流程，这是整个文件的核心
   → 注意：为什么第一层缓存编译所有 workflow，第二层缓存只映射激活的 config？

2. getAIResponse() - 第 631-772 行
   → 理解如何使用缓存中的 workflow，以及重试逻辑
   → 注意：为什么需要重试？workflow.invoke() 可能返回什么？

3. getWorkflow() - 第 265-287 行（虽然注释被我删了，但逻辑很重要）
   → 理解两层缓存的查询流程：scope -> workflowId -> CompiledStateGraph
   → 注意：为什么需要两层缓存，而不是一层？

【我想改 A/B/C 功能，各自最可能改哪一段 + 风险点 + 如何验证】

A. 添加新的 workflow 缓存策略（如 LRU、TTL）
   → 改哪里：第 90-103 行（workflowCache Map 定义）+ 第 133-223 行（initialize 方法）
   → 风险点：
     1) 缓存失效可能导致 workflow 未编译，需要在 getWorkflow 时做容错
     2) 清理缓存时需要同步清理两层缓存，避免不一致
   → 如何验证：
     1) 单元测试：模拟缓存失效，检查是否会自动重新编译
     2) 集成测试：修改 DB 后调用 refresh()，检查缓存是否更新
     3) 性能测试：TTL 过期后，检查重新编译的性能开销

B. 修改 AI 回复重试逻辑（如改变重试次数、退避策略）
   → 改哪里：第 753-769 行（while 循环）
   → 风险点：
     1) 增加重试次数可能导致请求堆积，影响响应时间
     2) 减少重试次数可能导致成功率下降，用户体验变差
   → 如何验证：
     1) 单元测试：模拟 LLM 返回空字符串，检查重试次数是否符合预期
     2) 压力测试：模拟 LLM 故障，检查重试逻辑不会导致雪崩
     3) 监控指标：记录重试次数和成功率，观察修改前后的变化

C. 修复 streamAIResponse 的 BUG（只 yield smart chat 节点的 response）
   → 改哪里：第 931-941 行（for await 循环）
   → 风险点：
     1) 需要知道 smart chat 节点的 nodeId（可能在 workflow 定义中）
     2) 如果 workflow 有多个 smart chat 节点，可能需要全部 yield
   → 如何验证：
     1) 单元测试：mock workflow.stream()，检查只 yield 指定节点的 response
     2) 集成测试：创建包含多个节点的 workflow，检查输出是否只包含 smart chat 节点
     3) 日志验证：添加 log 记录 nodeId，手动检查是否只 yield 了正确的节点

【如何快速验证我的理解】
1. 阅读 schema 中的 workflow 和 aiRoleConfig 表定义（server/db/schema.ts）
2. 阅读 WorkflowBuilder 类的 build() 方法（workflow-builder.ts）
3. 阅读 WorkflowState 类型定义（workflow-node/workflow-tools.ts）
4. 运行 initialize() 并打印缓存内容，验证两层缓存的结构
5. 修改 workflow 表并调用 refresh()，观察缓存是否更新

【常见疑问解答】
Q: 为什么需要两层缓存，而不是直接 Map<scope, CompiledStateGraph>？
A: 因为多个 scope 可能共享同一个 workflow，两层缓存避免重复编译同一个 workflow

Q: 为什么 initialize() 编译所有 workflow，而不仅仅是激活的？
A: 因为管理员可能随时激活一个新的 config，如果 workflow 没有编译，会导致请求失败

Q: getAIResponse 和 streamAIResponse 有什么区别？什么时候用哪个？
A: getAIResponse 是阻塞式的，适合不需要实时显示的场景（如异步任务）；streamAIResponse 是流式的，适合需要实时显示的场景（如聊天界面）

Q: 为什么需要重试逻辑？LLM 返回空字符串是什么原因？
A: 可能是网络问题、API 限流、LLM 内部错误等。重试可以提高成功率
*/
