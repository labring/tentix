const referenceNames = {
  "secret:emotion": "TENTIX_AI_EMOTION_KEY",
  "secret:escalation": "TENTIX_AI_ESCALATION_KEY",
  "secret:search": "TENTIX_AI_SEARCH_KEY",
  "secret:intent": "TENTIX_AI_INTENT_KEY",
} as const;

export { workflowSecretReferences } from "./workflow-node-schema";

export function resolveWorkflowApiKey(reference: string | undefined) {
  if (!reference) return undefined;
  if (!Object.hasOwn(referenceNames, reference)) throw new Error("Unknown workflow secret reference");
  const name = referenceNames[reference as keyof typeof referenceNames];
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Missing workflow secret: " + name);
  return value;
}

export function assertWorkflowSecretReferences(nodes: Array<{ config?: unknown }>) {
  for (const node of nodes) {
    const config = node.config as {
      llm?: { apiKey?: string };
      generateSearchQueriesLLM?: { apiKey?: string };
      intentAnalysisConfig?: { intentAnalysisLLM?: { apiKey?: string } };
    } | null | undefined;
    for (const value of [config?.llm?.apiKey, config?.generateSearchQueriesLLM?.apiKey,
      config?.intentAnalysisConfig?.intentAnalysisLLM?.apiKey]) {
      resolveWorkflowApiKey(value);
    }
  }
}
