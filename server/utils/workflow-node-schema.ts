import { z } from "zod";
import { NodeType } from "./const";

export const workflowSecretReferences = ["secret:emotion", "secret:escalation", "secret:search", "secret:intent"] as const;

const llmSchema = z.object({
  model: z.string(),
  baseURL: z.string().optional(),
  apiKey: z.union([z.enum(workflowSecretReferences), z.literal("")]).optional(),
}).strict();
const handleSchema = z.object({
  id: z.string().min(1),
  position: z.enum(["top", "right", "bottom", "left"]),
  type: z.enum(["source", "target"]),
  condition: z.string().max(1024).optional(),
}).strict();
const common = {
  id: z.string().min(1), name: z.string(),
  description: z.string().optional(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().optional(),
  handles: z.array(handleSchema).optional(),
};
const emptyConfig = z.union([z.null(), z.object({}).strict()]).optional();
const prompt = { systemPrompt: z.string(), userPrompt: z.string() };
export const WorkflowNodeSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal(NodeType.START), config: emptyConfig }).strict(),
  z.object({ ...common, type: z.literal(NodeType.END), config: emptyConfig }).strict(),
  z.object({ ...common, type: z.literal(NodeType.VARIABLE_SETTER), config: z.object({}).strict() }).strict(),
  z.object({ ...common, type: z.literal(NodeType.EMOTION_DETECTOR),
    config: z.object({ ...prompt, llm: llmSchema.optional() }).strict() }).strict(),
  z.object({ ...common, type: z.literal(NodeType.HANDOFF),
    config: z.object({ messageTemplate: z.string(),
      notifyChannels: z.enum(["feishu", "email", "wechat", "sms"]).optional() }).strict() }).strict(),
  z.object({ ...common, type: z.literal(NodeType.ESCALATION_OFFER),
    config: z.object({ ...prompt, llm: llmSchema.optional(), escalationOfferMessageTemplate: z.string() }).strict() }).strict(),
  z.object({ ...common, type: z.literal(NodeType.SMART_CHAT),
    config: z.object({ ...prompt, enableVision: z.boolean().optional(), llm: llmSchema.optional(),
      visionConfig: z.object({ includeTicketDescriptionImages: z.boolean() }).strict().optional() }).strict() }).strict(),
  z.object({ ...common, type: z.literal(NodeType.RAG),
    config: z.object({
      enableIntentAnalysis: z.boolean(),
      intentAnalysisConfig: z.object({
        intentAnalysisUserPrompt: z.string(), intentAnalysisSystemPrompt: z.string(),
        intentAnalysisLLM: llmSchema.optional(),
      }).strict().optional(),
      generateSearchQueriesUserPrompt: z.string(), generateSearchQueriesSystemPrompt: z.string(),
      generateSearchQueriesLLM: llmSchema.optional(),
    }).strict() }).strict(),
  z.object({ ...common, type: z.literal(NodeType.MCP),
    config: z.object({
      enabled: z.boolean().optional(), baseUrl: z.string().optional(),
      apis: z.array(z.object({ id: z.string(), name: z.string(),
        method: z.enum(["GET", "POST"]), path: z.string() }).strict()).optional(),
      selectedApiId: z.string().optional(), enableAiSelection: z.boolean().optional(),
      systemPrompt: z.string().optional(), userPrompt: z.string().optional(),
      llm: llmSchema.optional(), isSealosRuntime: z.boolean().optional(),
    }).strict() }).strict(),
]);


export const WorkflowNodesSchema = z.array(WorkflowNodeSchema).max(256);
