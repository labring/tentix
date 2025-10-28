import { on, Events } from "./bus";
import { connectDB } from "@/utils/tools";
import { knowledgeBuilder } from "@/utils/kb/const";
import { markSynced, markFailed } from "./favoritedKnowledgeRepo";
import { logWarning } from "@/utils/log";

on(Events.KBFavoritesSync, async (payload) => {
  const db = connectDB();
  try {
    // 调用你提供的构建逻辑
    await knowledgeBuilder.buildFavoritedConversations(
      payload.ticketId,
      payload,
    );

    await markSynced(db, payload.id);
  } catch (err) {
    logWarning(`[kb.favorites.sync] failed id=${payload.id}: ${String(err)}`);
    await markFailed(db, payload.id);
  }
});
