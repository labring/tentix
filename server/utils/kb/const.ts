import { KnowledgeBuilderConfig } from "./types";
import { connectDB } from "@/utils/tools";
import { ExternalHttpStore, PgVectorStore } from "./vectorStore";
import { KnowledgeBuilderService } from "./builder";
import { OPENAI_CONFIG } from "./config";

export const knowledgeBuilderConfig: KnowledgeBuilderConfig = {
  externalProvider: new ExternalHttpStore(
    OPENAI_CONFIG.externalVectorBaseURL || "",
  ),
  internalProvider: new PgVectorStore(connectDB()),
  db: connectDB(),
};

export const knowledgeBuilder = new KnowledgeBuilderService(
  knowledgeBuilderConfig,
);
