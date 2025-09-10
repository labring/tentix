export const SOURCE_WEIGHTS: Record<string, number> = {
  favorited_conversation: 1.0,
  historical_ticket: 0.8,
  general_knowledge: 0.6,
};

export const OPENAI_CONFIG = {
  baseURL: global.customEnv.OPENAI_BASE_URL,
  apiKey: global.customEnv.OPENAI_API_KEY,
  tabChatModel: global.customEnv.TAB_CHAT_MODEL,
  summaryModel: global.customEnv.SUMMARY_MODEL,
  fastModel: global.customEnv.FAST_MODEL,
  chatModel: global.customEnv.CHAT_MODEL,
  embeddingModel: global.customEnv.EMBEDDING_MODEL,
  vectorBackend: global.customEnv.VECTOR_BACKEND,
  externalVectorBaseURL: global.customEnv.EXTERNAL_VECTOR_BASE_URL,
};


