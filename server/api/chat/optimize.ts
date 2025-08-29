import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { factory, authMiddleware } from "../middleware.ts";
import { connectDB } from "@/utils/index.ts";
import { readConfig } from "@/utils/env.ts";
import { eq, desc } from "drizzle-orm";
import * as schema from "@/db/schema.ts";
import { ChatOpenAI } from "@langchain/openai";

const optimizeRequestSchema = z.object({
  originalText: z.string().min(1).max(2000),
  ticketId: z.string().length(13),
  messageType: z.enum(["public", "internal"]).default("public"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const optimizeResponseSchema = z.object({
  success: z.boolean(),
  optimizedText: z.string(),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()),
  reasoning: z.string(),
  error: z.string().optional(),
});

const optimizeRouter = factory
  .createApp()
  .use(authMiddleware)
  .post(
    "/optimize",
    describeRoute({
      tags: ["Chat"],
      description: "Optimize text using AI",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Text optimized successfully",
          content: {
            "application/json": { schema: resolver(optimizeResponseSchema) },
          },
        },
      },
    }),
    zValidator("json", optimizeRequestSchema),
    async (c) => {
      const { originalText, ticketId, messageType, priority } = c.req.valid("json");
      const userId = c.var.userId;
      const role = c.var.role;

      console.log('🎯 Optimize API called:', { originalText, ticketId, messageType, userId, role });

      try {
        const db = connectDB();
        const config = await readConfig();
        
        // OpenAI配置从环境变量读取
        const openaiConfig = {
          OPENAI_API_KEY: global.customEnv.OPENAI_API_KEY,
          OPENAI_BASE_URL: global.customEnv.OPENAI_BASE_URL,
          FAST_MODEL: global.customEnv.FAST_MODEL || "gpt-4o-mini"
        };
        
        console.log('🔧 Config loaded:', { 
          hasOpenAI: !!openaiConfig.OPENAI_API_KEY, 
          baseURL: openaiConfig.OPENAI_BASE_URL,
          model: openaiConfig.FAST_MODEL 
        });

        // 获取工单上下文
        const ticket = await db.query.tickets.findFirst({
          where: eq(schema.tickets.id, ticketId),
          with: {
            messages: {
              orderBy: desc(schema.chatMessages.createdAt),
              limit: 5,
              with: {
                sender: {
                  columns: { role: true, name: true }
                }
              }
            }
          }
        });

        if (!ticket) {
          return c.json({
            success: false,
            error: "Ticket not found"
          }, 404);
        }

        console.log('📄 Ticket found:', !!ticket);
        
        // 构建上下文并进行AI优化
        console.log('🤖 Starting AI optimization...');
        const result = await optimizeTextWithAI({
          originalText,
          ticketModule: ticket.module || "",
          ticketCategory: ticket.category || "",
          ticketDescription: extractTextContent(ticket.description) || "",
          recentMessages: ticket.messages
            ?.slice(0, 3)
            .map((msg: any) => `${msg.sender.role}: ${extractTextContent(msg.content)}`)
            .join("\n") || "",
          messageType,
          priority
        }, openaiConfig);
        
        return c.json({
          success: true,
          ...result
        });

      } catch (error) {
        console.error("Text optimization error:", error);
        return c.json({
          success: false,
          error: "Failed to optimize text"
        }, 500);
      }
    }
  );

export { optimizeRouter };

interface OptimizationContext {
  originalText: string;
  ticketModule: string;
  ticketCategory: string;
  ticketDescription: string;
  recentMessages: string;
  messageType: "public" | "internal";
  priority?: string;
}

const optimizationSchema = z.object({
  optimizedText: z.string(),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()),
  reasoning: z.string(),
});

export async function optimizeTextWithAI(
  context: OptimizationContext,
  config: any
): Promise<z.infer<typeof optimizationSchema>> {
  
  console.log('🚀 Creating ChatOpenAI model...');
  
  const model = new ChatOpenAI({
    modelName: config.FAST_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 1000,
    configuration: {
      baseURL: config.OPENAI_BASE_URL,
      apiKey: config.OPENAI_API_KEY,
    },
  });

  const systemPrompt = `
你是专业的客服文本优化助手，负责优化客服回复文本，使其更加专业、清晰、友好。

## 优化原则
1. **专业性**: 使用准确的技术术语，避免口语化表达
2. **清晰性**: 逻辑清晰，步骤明确，易于理解
3. **友好性**: 保持礼貌和耐心，体现服务意识
4. **简洁性**: 去除冗余，突出重点信息
5. **一致性**: 与工单主题和上下文保持一致

## 输出格式
请严格按照以下JSON格式输出：
{
  "optimizedText": "优化后的文本",
  "confidence": 0.95,
  "suggestions": ["建议1", "建议2"],
  "reasoning": "优化理由"
}

confidence: 0-1之间的数值，表示优化质量
suggestions: 2-3条改进建议
reasoning: 简要说明优化思路
`;

  const userPrompt = `
## 工单信息
- 模块: ${context.ticketModule}
- 分类: ${context.ticketCategory}
- 描述: ${context.ticketDescription}
- 消息类型: ${context.messageType}
- 优先级: ${context.priority || "未设置"}

## 最近对话
${context.recentMessages}

## 待优化文本
${context.originalText}

请根据以上上下文优化文本，确保专业性和一致性。
`;

  try {
    console.log('Invoking AI model...');
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);

    const content = typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);
    const result = optimizationSchema.parse(JSON.parse(content));
    return result;
  } catch (error) {
    console.error(" optimization failed:", error);
    return {
      optimizedText: context.originalText,
      confidence: 0.0,
      suggestions: ["优化失败，请手动检查"],
      reasoning: "优化过程中出现错误"
    };
  }
}

// 简单的文本提取函数
function extractTextContent(content: any): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";
  
  try {
    if (content.type === "doc" && Array.isArray(content.content)) {
      return content.content
        .map((node: any) => extractNodeText(node))
        .filter(Boolean)
        .join(" ");
    }
    return "";
  } catch {
    return "";
  }
}

function extractNodeText(node: any): string {
  if (!node || typeof node !== "object") return "";
  
  if (node.type === "text") return node.text || "";
  if (node.type === "paragraph" && Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join("");
  }
  if (Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join("");
  }
  
  return "";
}
