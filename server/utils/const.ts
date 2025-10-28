export const areaEnumArray = [
  "bja",
  "hzh",
  "gzg",
  "io",
  "usw",
  "test",
] as const;

/**
 * Area region UUID mapping
 */
export const areaRegionUuidMap = {
  bja: "0dba3d90-2bae-4fb6-83f7-89620656574f",
  hzh: "f8fe0f97-4550-472f-aa9a-72ed34e60952",
  gzg: "6a216614-e658-4482-a244-e4311390715f",
  io: "2e07bb48-e88c-4bb8-b2c8-03198b8fe66d",
  usw: "00000000-0000-0000-0000-000000000000",
  test: "00000000-0000-0000-0000-000000000000",
} as const;

export const ticketCategoryEnumArray = [
  "uncategorized",
  "bug",
  "feature",
  "question",
  "other",
] as const;

/**
 * Ticket priority enum array
 *
 * @example
 * "normal" // normal consultation
 * "low" // operation experience problem
 * "medium" // business/system exception affects use
 * "high" // business completely unavailable
 * "urgent" // urgent
 */
export const ticketPriorityEnumArray = [
  "urgent",
  "high",
  "medium",
  "normal",
  "low",
] as const;

export const ticketStatusEnumArray = [
  "pending",
  "in_progress",
  "resolved",
  "scheduled",
] as const;

export type TicketStatus = (typeof ticketStatusEnumArray)[number];

/**
 * Ticket history type enum array
 *
 * @description
 * | **history_type** | **meta(integer)**            |
 * |:----------------:|:--------------------------:|
 * | create           | customer user Id           |
 * | update           | who modify the information |
 * | assign           | The assignee Id            |
 * | upgrade          | who modify this            |
 * | transfer         | transfer to somebody's Id  |
 * | makeRequest      | who do this                |
 * | resolve          | who resolve this           |
 * | close            | who close this             |
 *
 */
export const ticketHistoryTypeEnumArray = [
  "create",
  "first_reply",
  "join",
  "category",
  "update",
  "upgrade",
  "transfer",
  "makeRequest",
  "resolve",
  "close",
  "other",
] as const;

export const userRoleEnumArray = [
  "system",
  "customer",
  "agent",
  "technician",
  "admin",
  "ai",
] as const;

// Feedback type enum array
// "like"
// "dislike"
export const feedbackTypeEnumArray = ["like", "dislike"] as const;

export const dislikeReasonEnumArray = [
  "irrelevant", // 不相关
  "unresolved", // 未解决
  "unfriendly", // 不友好
  "slow_response", // 响应慢
  "other", // 其他
] as const;

// Sync status enum array
export const syncStatusEnumArray = [
  "pending",
  "synced",
  "failed",
  "processing",
] as const;

export const handoffPriorityEnumArray = ["P1", "P2", "P3"] as const;
export const sentimentLabelEnumArray = [
  "NEUTRAL",
  "FRUSTRATED",
  "ANGRY",
  "REQUEST_AGENT",
  "ABUSIVE",
  "CONFUSED",
  "ANXIOUS",
  "SATISFIED",
] as const;

export type SentimentLabel = (typeof sentimentLabelEnumArray)[number];

export type HandoffNotifyChannel = "feishu" | "email" | "wechat" | "sms";

/**
 * WebSocket token expiry time
 *
 * @example
 * 12 * 60 * 60 * 1000 // 12 hour in milliseconds
 */
export const WS_TOKEN_EXPIRY_TIME = 12 * 60 * 60 * 1000;

/**
 * Cookie expiry time
 *
 * @example
 * 1000 * 60 * 60 * 24 * 30 // 30 days in milliseconds
 */
export const COOKIE_EXPIRY_TIME = 1000 * 60 * 60 * 24 * 30;

export function getIndex<T extends readonly string[]>(arr: T, key: T[number]) {
  return arr.findIndex((item) => item === key);
}

export function getEnumKey<T extends readonly string[]>(arr: T, index: number) {
  return arr[index];
}

// workflow node type enum array
export enum NodeType {
  EMOTION_DETECTOR = "emotionDetector", // 情绪检测
  HANDOFF = "handoff", // 转人工
  SMART_CHAT = "smartChat", // 智能聊天
  ESCALATION_OFFER = "escalationOffer", // 升级询问
  VARIABLE_SETTER = "variableSetter", // 变量设置
  RAG = "rag", // 检索增强生成
  START = "start", // 哨兵节点
  END = "end",
}
export enum WorkflowEdgeType {
  CONDITION = "condition",
  NORMAL = "normal",
}

// node config
export interface BaseNodeConfig {
  id: string;
  type: NodeType;
  name: string;
  position?: { x: number; y: number };
  handles?: HandleConfig[];
  description?: string;
}
export interface EmotionDetectionConfig extends BaseNodeConfig {
  type: NodeType.EMOTION_DETECTOR;
  config: {
    llm?: LLMConfig;
    systemPrompt: string;
    userPrompt: string;
  };
}

export interface HandoffConfig extends BaseNodeConfig {
  type: NodeType.HANDOFF;
  config: {
    messageTemplate: string;
    notifyChannels?: HandoffNotifyChannel;
  };
}

export interface EscalationOfferConfig extends BaseNodeConfig {
  type: NodeType.ESCALATION_OFFER;
  config: {
    escalationOfferMessageTemplate: string;
    llm?: LLMConfig;
    systemPrompt: string;
    userPrompt: string;
  };
}

export interface SmartChatConfig extends BaseNodeConfig {
  type: NodeType.SMART_CHAT;
  config: {
    systemPrompt: string;
    userPrompt: string;
    enableVision: boolean;
    llm?: LLMConfig;
    visionConfig?: {
      includeTicketDescriptionImages: boolean;
    };
  };
}

export interface RagConfig extends BaseNodeConfig {
  type: NodeType.RAG;
  config: {
    enableIntentAnalysis: boolean;
    intentAnalysisConfig?: {
      intentAnalysisUserPrompt: string;
      intentAnalysisSystemPrompt: string;
      intentAnalysisLLM?: LLMConfig;
    };
    generateSearchQueriesUserPrompt: string;
    generateSearchQueriesSystemPrompt: string;
    generateSearchQueriesLLM?: LLMConfig;
    // searchQueries: number;
    // topK: number;
  };
}

export type NodeConfig =
  | EmotionDetectionConfig
  | HandoffConfig
  | EscalationOfferConfig
  | SmartChatConfig
  | RagConfig
  | BaseNodeConfig;

export type NodeConfigData =
  | EmotionDetectionConfig["config"]
  | HandoffConfig["config"]
  | EscalationOfferConfig["config"]
  | SmartChatConfig["config"]
  | RagConfig["config"];
export interface LLMConfig {
  apiKey?: string; // 可不填 -> 用全局 OPENAI_CONFIG
  baseURL?: string; // 可不填 -> 用全局 OPENAI_CONFIG
  model: string; // 必填：模型名
}

export interface HandleConfig {
  id: string;
  position: "top" | "right" | "bottom" | "left";
  type: "source" | "target";
  // 仅用于前端（React Flow）展示与编辑时记录条件，
  // 实际路由逻辑只读取 WorkflowEdge.condition
  condition?: string;
}

export interface WorkflowEdge {
  id: string;
  type: WorkflowEdgeType;
  source: string;
  target: string;
  condition?: string;
  source_handle?: string; // 源节点连接点ID
  target_handle?: string; // 目标节点连接点ID
}

export interface WorkflowConfig {
  id?: string;
  name: string;
  description: string;
  nodes: Array<
    | EmotionDetectionConfig
    | HandoffConfig
    | EscalationOfferConfig
    | SmartChatConfig
    | RagConfig
    | BaseNodeConfig
  >;
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}
