import { type CompiledStateGraph } from "@langchain/langgraph";
import { eq, asc } from "drizzle-orm";
import * as schema from "@/db/schema.ts";
import { connectDB } from "../tools";
import { type WorkflowState, AgentMessage } from "./chat-node";
import { logError, logInfo } from "@/utils/log.ts";
import { WorkflowBuilder } from "./agent";
import { convertToMultimodalMessage, sleep } from "./tools";
import { basicUserCols } from "../../api/queryParams.ts";
import { type JSONContentZod } from "../types";
import { type JSONContent } from "@tiptap/core";

/**
 * 工作流缓存管理类
 *
 * 根据 aiRoleConfig 表管理不同 scope 的工作流缓存
 * 缓存结构: scope -> { aiUserId, compiledWorkflow }
 *
 * @example
 * ```typescript
 * // 初始化缓存
 * await workflowCache.initialize();
 *
 * // 获取工作流
 * const workflow = workflowCache.getWorkflow("default_all");
 * if (workflow) {
 *   const result = await workflow.invoke(initialState);
 * }
 *
 * // 当配置变化时更新缓存
 * await workflowCache.refresh();
 * ```
 */
export class WorkflowCache {
  private cache: Map<
    string,
    {
      aiUserId: number;
      compiledWorkflow: CompiledStateGraph<
        WorkflowState,
        Partial<WorkflowState>
      >;
    }
  > = new Map();

  /**
   * 初始化缓存
   *
   * 从 aiRoleConfig 表加载所有激活的 AI 角色配置并构建工作流缓存
   *
   * 流程：
   * 1. 查询所有 isActive=true 的 aiRoleConfig 记录
   * 2. 对每个配置，根据绑定的 workflow 构建编译后的工作流
   * 3. 以 scope 为键存储到缓存中
   *
   * @throws {Error} 如果工作流构建失败会记录错误日志，但不会中断整个初始化过程
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * const cache = new WorkflowCache();
   * await cache.initialize();
   * console.log(`Cached ${cache.size()} workflows`);
   * ```
   */
  async initialize(): Promise<void> {
    logInfo("[WorkflowCache] Initializing workflow cache...");

    const db = connectDB();

    const activeConfigs = await db.query.aiRoleConfig.findMany({
      where: eq(schema.aiRoleConfig.isActive, true),
      with: {
        workflow: true,
      },
    });

    logInfo(
      `[WorkflowCache] Found ${activeConfigs.length} active AI role configs`,
    );

    this.cache.clear();

    for (const config of activeConfigs) {
      try {
        if (!config.workflow) {
          logInfo(
            `[WorkflowCache] Skipping config ${config.id} (scope: ${config.scope}) - no workflow bound`,
          );
          continue;
        }

        const builder = new WorkflowBuilder(config.workflow);
        const compiledWorkflow = builder.build();

        this.cache.set(config.scope, {
          aiUserId: config.aiUserId,
          compiledWorkflow,
        });

        logInfo(
          `[WorkflowCache] Cached workflow for scope: ${config.scope} (aiUserId: ${config.aiUserId}, workflowId: ${config.workflowId})`,
        );
      } catch (error) {
        logError(
          `[WorkflowCache] Failed to build workflow for config ${config.id}`,
          error,
        );
      }
    }

    logInfo(
      `[WorkflowCache] Initialization complete. Cached ${this.cache.size} workflows`,
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
    const cached = this.cache.get(scope);
    if (!cached) {
      logInfo(
        `[WorkflowCache] No workflow found for scope: ${scope}. Available scopes: ${Array.from(this.cache.keys()).join(", ")}`,
      );
      return null;
    }
    return cached.compiledWorkflow;
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
    const cached = this.cache.get(scope);
    return cached?.aiUserId ?? null;
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
    return Array.from(this.cache.keys());
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
    return this.cache.has(scope);
  }

  /**
   * 获取缓存的大小
   *
   * @returns {number} 缓存中的工作流数量
   *
   * @example
   * ```typescript
   * console.log(`Cached workflows: ${workflowCache.size()}`);
   * ```
   */
  size(): number {
    return this.cache.size;
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
    this.cache.clear();
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
  typeof schema.workflowTestMessage.$inferSelect | typeof schema.chatMessages.$inferSelect,
  "id" | "senderId" | "content" | "createdAt"
> & {
  sender: Pick<
    typeof schema.users.$inferSelect,
    "id" | "name" | "nickname" | "avatar" | "role"
  > | null;
};

export async function getAIResponse(
  ticket: Pick<
    typeof schema.tickets.$inferSelect,
    "id" | "title" | "description" | "module" | "category"
  >,
  isWorkflowTest: boolean = false,
): Promise<string> {
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

  // 3) 组装到状态
  /*
      [
      {
        role: "ai",
        content: "some text",
        createdAt: "2025-08-15 16:24:13.307+00",
      }, {
        role: "customer",
        content: [
          {
            type: "text",
            text: "some text",
          }, {
            type: "image_url",
            image_url: {
              url: "https://xxx.com/xxx.png",
            },
          }
        ],
        createdAt: "2025-08-15 16:24:43.275+00",
      }
    ]
  */
  const history: AgentMessage[] = [];
  for (const m of msgs) {
    if (!m) continue;
    const role = m.sender?.role ?? "user";
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

  const workflow =
    workflowCache.getWorkflow(ticket.module) ??
    workflowCache.getFallbackWorkflow();

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
    response: "",
    proposeEscalation: false,
    escalationReason: "",
    variables: {},
  };

  // 当响应为空字符串时，进行最多三次重试（总尝试次数最多四次）
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = (await workflow.invoke(initialState)) as WorkflowState;
      const response = result.response ?? "";
      if (response !== "") {
        return response;
      }
    } catch (e) {
      logError(String(e));
    }

    attempt++;
    if (attempt <= maxRetries) {
      await sleep(300);
    }
  }

  return "";
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
