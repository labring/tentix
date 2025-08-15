import { startFavoritedKnowledgeSyncJob } from "./favorited-knowledge-sync";
import "./favoritedKnowledgeListener.ts";

export function startAllJobs() {
  const poller = startFavoritedKnowledgeSyncJob();
  return { poller };
}
