import { factory, authMiddleware } from "../middleware.ts";
import { describeRoute } from "hono-openapi";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { organizeContextWithAI, type RawTicketData } from "./ai-organize.ts";

const aiOrganizeSchema = z.object({
  rawData: z.object({
    userId: z.string(),
    userName: z.string(),
    namespace: z.string(),
    region: z.string(),
    ticketId: z.string(),
    priority: z.string(),
    status: z.string(),
    title: z.string(),
    description: z.string(),
    recentMessages: z.string(),
    createdAt: z.string(),
    category: z.string(),
    module: z.string(),
  }),
});

export const aiOrganizeRouter = factory
  .createApp()
  .use(authMiddleware)
  .post(
    "/ai-organize",
    describeRoute({
      tags: ["Chat"],
      summary: "AI智能整理上下文",
      description: "第三步：使用AI智能整理工单上下文为专业格式",
    }),
    zValidator("json", aiOrganizeSchema),
    async (c) => {
      const { rawData } = c.req.valid("json");

      try {
       
        const typedRawData: RawTicketData = rawData;
        const organizedText = await organizeContextWithAI(typedRawData);

        return c.json({
          success: true,
          data: {
            ...rawData,
            organizedText,
          },
        });
      } catch (error: any) {
        console.error("AI整理失败:", error);
        return c.json(
          { 
            success: false, 
            error: error.message || "AI整理失败，请重试" 
          },
          500
        );
      }
    },
  );