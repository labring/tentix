import {
  WorkflowState,
  getVariables,
  buildMultimodalUserContent,
  DEFAULT_API_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  MMItem,
} from "./workflow-tools";
import { SmartChatConfig } from "@/utils/const";
import { renderTemplate as renderLiquidTemplate } from "@/utils/template";
import { ChatOpenAI } from "@langchain/openai";
import { type SearchHit } from "../types";
import { logError } from "@/utils/log";

export async function chatNode(
  state: WorkflowState,
  config: SmartChatConfig["config"],
): Promise<Partial<WorkflowState>> {
  try {
    const variables = getVariables(state);
    const retrievedContext = variables.retrievedContext;

    const retrievedContextCount = retrievedContext?.length ?? 0;

    const retrievedContextString =
      retrievedContextCount > 0
        ? retrievedContext
            .map((x: SearchHit, i: number) => {
              const label =
                x.source_type === "favorited_conversation"
                  ? "精选案例"
                  : x.source_type === "historical_ticket"
                    ? "历史工单"
                    : "通用知识";
              return `${i + 1}. [${label}]\n内容: ${x.content}`;
            })
            .join("\n\n")
        : "";

    const systemPrompt = await renderLiquidTemplate(config.systemPrompt, {
      ...variables,
      retrievedContextString,
      retrievedContextCount,
    });
    const userPrompt = await renderLiquidTemplate(config.userPrompt, {
      ...variables,
      retrievedContextString,
      retrievedContextCount,
    });

    let mm: MMItem[] = [];
    if (config.enableVision) {
      mm = buildMultimodalUserContent(
        userPrompt,
        state,
        config.visionConfig?.includeTicketDescriptionImages,
      );
    }

    // 以 system + user 的顺序调用模型（符合 LangChain 规范）
    const chat = new ChatOpenAI({
      apiKey: config.llm?.apiKey || DEFAULT_API_KEY,
      model: config.llm?.model || DEFAULT_MODEL,
      configuration: {
        baseURL: config.llm?.baseURL || DEFAULT_BASE_URL,
      },
    });

    const resp = await chat.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: config.enableVision ? mm : userPrompt },
    ]);
    const text =
      typeof resp.content === "string"
        ? resp.content
        : JSON.stringify(resp.content);
    return { response: text };
  } catch (error) {
    logError("chatNode: ", error);
    return { response: "" };
  }
}
