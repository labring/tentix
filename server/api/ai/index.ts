import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { saveMessageToDb } from "@/utils/dbAction.ts";
import { JSONContentZod } from "@/utils/types.ts";

const fastgpt_url = process.env.FASTGPT_API_URL;
const fastgpt_key = process.env.FASTGPT_API_KEY;
const fastgpt_limit = parseInt(process.env.FASTGPT_API_LIMIT || '50');

// Helper function to check if message mentions the bot
const isBotMentioned = (content: JSONContentZod[]) => {
  return content.some((block) => 
    block.type === 'mention' && 
    block.meta === '1'
  );
};

// Helper function to get AI response
const getAIResponse = async (messages: any[]) => {
  if (!fastgpt_url || !fastgpt_key) {
    throw new HTTPException(500, {
      message: 'Missing FastGPT configuration'
    });
  }

  const data = {
    chatId: crypto.randomUUID(),
    stream: false,
    detail: false,
    messages: messages
  };

  const response = await fetch(fastgpt_url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fastgpt_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new HTTPException(500, {
      message: 'Failed to get AI response'
    });
  }

  const result = await response.json();
  return result;
};

// Main function to handle AI interactions
export const handleAIInteraction = async (
  type: "message" | "ticket_created",
  ticketId: number,
  userId: number,
  content?: string,
  ticketInfo?: {
    title: string;
    description: string;
    category: string;
  }
) => {
  try {
    let messages: { content: JSONContentZod, role: string }[] = [];
    let shouldRespond = false;

    if (type === "message" && content) {
      // Check if message mentions the bot
      if (isBotMentioned(content)) {
        shouldRespond = true;
        messages = [{
          content: content,
          role: 'user'
        }];
      }
    } else if (type === "ticket_created" && ticketInfo) {
      shouldRespond = true;
      messages = [{
        content: [{
          type: 'text',
          content: `新工单创建：\n标题：${ticketInfo.title}\n描述：${ticketInfo.description}\n分类：${ticketInfo.category}`
        }],
        role: 'user'
      }];
    }

    if (shouldRespond) {
      const aiResponse = await getAIResponse(messages);
      
      // Save AI response to database
      if (aiResponse?.content) {
        const savedMessage = await saveMessageToDb(
          ticketId,
          0, // bot userId
          [{
            type: 'text',
            content: aiResponse.content
          }]
        );

        return {
          success: true,
          messageId: savedMessage?.id
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error processing AI interaction:", error);
    throw new HTTPException(500, {
      message: 'Internal server error'
    });
  }
};

// Keep the API endpoint for testing
const aiRouter = new Hono()
  .post(
    "/webhook",
    describeRoute({
      tags: ["AI"],
      description: "Test AI interaction endpoint",
    }),
    zValidator(
      "json",
      z.object({
        type: z.enum(["message", "ticket_created"]),
        ticketId: z.number(),
        userId: z.number(),
        content: z.array(z.any()).optional(),
        ticketInfo: z.object({
          title: z.string(),
          description: z.string(),
          category: z.string(),
        }).optional(),
      }),
    ),
    async (c) => {
      const { type, ticketId, userId, content, ticketInfo } = c.req.valid("json");
      const result = await handleAIInteraction(type, ticketId, userId, content, ticketInfo);
      return c.json(result);
    }
  );

export { aiRouter };
