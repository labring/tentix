import {
  WorkflowState,
  getVariables,
  buildMultimodalUserContent,
  DEFAULT_API_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
} from "./workflow-tools";
import { z } from "zod";
import { EscalationOfferConfig } from "@/utils/const";
import { renderTemplate as renderLiquidTemplate } from "@/utils/template";
import { ChatOpenAI } from "@langchain/openai";
import { logError } from "@/utils";

// 询问是否转人工节点
const escalationDecisionSchema = z.object({
  decision: z.enum(["PROPOSE_ESCALATION", "CONTINUE"]),
  reasons: z.array(z.string()).max(10).default([]),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
});

export async function escalationOfferNode(
  state: WorkflowState,
  config: EscalationOfferConfig["config"],
): Promise<Partial<WorkflowState>> {
  const variables = getVariables(state);
  // 简单可解释的“召回不足”信号
  const ctxCount = variables.retrievedContext?.length ?? 0;
  const weakRetrieval = ctxCount <= 1;

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
      .withStructuredOutput(escalationDecisionSchema)
      .invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: mm },
      ]);
    const propose = out.decision === "PROPOSE_ESCALATION";

    if (propose) {
      const text = await renderLiquidTemplate(
        config.escalationOfferMessageTemplate,
        variables,
      );

      return {
        response: text,
        proposeEscalation: propose,
        escalationReason:
          out.reasons?.[0] || (weakRetrieval ? "召回不足/上下文不充分" : ""),
        handoffPriority: out.priority || (weakRetrieval ? "P2" : "P3"),
      };
    }

    return {
      proposeEscalation: propose,
      escalationReason:
        out.reasons?.[0] || (weakRetrieval ? "召回不足/上下文不充分" : ""),
      handoffPriority: out.priority || (weakRetrieval ? "P2" : "P3"),
    };
  } catch (error) {
    logError("escalationCheckNode: ", error);
    // 保守：不拦截，让下游继续给方案
    return { proposeEscalation: false };
  }
}
