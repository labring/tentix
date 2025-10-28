import {
  WorkflowState,
  getVariables,
  buildMultimodalUserContent,
  DEFAULT_API_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
} from "./workflow-tools";
import { z } from "zod";
import { EmotionDetectionConfig } from "@/utils/const";
import { quickHandoffHeuristic } from "../tools";
import { renderTemplate as renderLiquidTemplate } from "@/utils/template";
import { ChatOpenAI } from "@langchain/openai";
import { logError } from "@/utils";

// 情感检测节点
const sentimentDecisionSchema = z.object({
  sentiment: z.enum([
    "NEUTRAL",
    "FRUSTRATED",
    "ANGRY",
    "REQUEST_AGENT",
    "ABUSIVE",
    "CONFUSED",
    "ANXIOUS",
    "SATISFIED",
  ]),
  handoff: z.boolean(),
  reasons: z.array(z.string()).max(10).default([]),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
});

export async function emotionDetectionNode(
  state: WorkflowState,
  config: EmotionDetectionConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  const { lastCustomerMessage } = variables;
  const quick = quickHandoffHeuristic(lastCustomerMessage);

  if (quick.handoff) {
    return {
      userQuery: lastCustomerMessage,
      handoffRequired: true,
      handoffReason: quick.reason || "触发快路径守门",
      handoffPriority: "P2",
      sentimentLabel: "REQUEST_AGENT",
    };
  }

  // TODO: 配合知识库检索进行优化，当检索命中时 增加ai对话机会，当检索未命中时 转人工更早，减少ai对话次数
  const systemPrompt = await renderLiquidTemplate(
    config.systemPrompt,
    variables,
  );

  const userPrompt = await renderLiquidTemplate(config.userPrompt, variables);

  const mm = buildMultimodalUserContent(userPrompt, state, false);

  const chat = new ChatOpenAI({
    apiKey: config.llm?.apiKey || DEFAULT_API_KEY,
    model: config.llm?.model || DEFAULT_MODEL,
    configuration: {
      baseURL: config.llm?.baseURL || DEFAULT_BASE_URL,
    },
  });

  try {
    const out = await chat
      .withStructuredOutput(sentimentDecisionSchema)
      .invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: mm },
      ]);

    return {
      userQuery: lastCustomerMessage,
      handoffRequired: out.handoff,
      handoffReason: out.reasons?.[0] || "",
      handoffPriority: out.priority || "P2",
      sentimentLabel: out.sentiment,
    };
  } catch (error) {
    logError("emotionDetectionNode", error);
    // 失败时，不拦截，继续后续流程
    return {
      userQuery: lastCustomerMessage,
      sentimentLabel: "NEUTRAL",
    };
  }
}
