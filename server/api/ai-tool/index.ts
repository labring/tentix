import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { factory, authMiddleware } from "../middleware.ts";
import { connectDB } from "@/utils/tools.ts";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "@/db/schema.ts";
import { optimizeTextWithAI } from "@/utils/kb/text-optimizer.ts";
import { organizeContextWithAI } from "@/utils/kb/context-organizer.ts";

const getContextDataSchema = z.object({
  ticketId: z.string(),
});

const getContextDataResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
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
  }).optional(),
  error: z.string().optional(),
});

const organizeContextSchema = z.object({
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

const organizeContextResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    organizedText: z.string(),
  }),
  error: z.string().optional(),
});

const optimizeTextSchema = z.object({
  originalText: z.string().min(1).max(2000),
  ticketId: z.string().length(13),
  messageType: z.enum(["public", "internal"]).default("public"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const optimizeTextResponseSchema = z.object({
  success: z.boolean(),
  optimizedText: z.string(),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()),
  reasoning: z.string(),
  error: z.string().optional(),
});

// ============== 路由定义 ==============

export const optimizeRouter = factory
  .createApp()
  .use(authMiddleware)
  
  // 获取工单基础数据
  .post(
    "/get-context-data",
    describeRoute({
      tags: ["Optimize"],
      summary: "获取工单基础数据",
      description: "第一步：获取工单的基础信息，包括用户信息、工单详情和对话记录",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "成功获取工单数据",
          content: {
            "application/json": { schema: resolver(getContextDataResponseSchema) },
          },
        },
      },
    }),
    zValidator("json", getContextDataSchema),
    async (c) => {
      const { ticketId } = c.req.valid("json");
      const db = connectDB();

      try {
        const ticket = await db.query.tickets.findFirst({
          where: (t, { eq }) => eq(t.id, ticketId),
          columns: {
            id: true,
            title: true,
            description: true,
            module: true,
            category: true,
            priority: true,
            status: true,
            customerId: true,
            createdAt: true,
            sealosNamespace: true,
            area: true,
          },
        });

        if (!ticket) {
          return c.json({ success: false, error: "工单不存在" }, 404);
        }

        // 获取客户信息
        console.log('🔍 Debug - ticket.customerId:', ticket.customerId, 'type:', typeof ticket.customerId);
        const customer = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, ticket.customerId),
          columns: {
            id: true,
            name: true,
          },
        });
        console.log('🔍 Debug - found customer:', customer);

        // 获取最近的消息记录
        const messages = await db.query.chatMessages.findMany({
          where: (m, { and, eq }) => and(
            eq(m.ticketId, ticketId), 
            eq(m.isInternal, false)
          ),
          orderBy: [desc(schema.chatMessages.createdAt)],
          limit: 10,
          columns: {
            content: true,
            createdAt: true,
          },
          with: {
            sender: {
              columns: {
                name: true,
                role: true,
              },
            },
          },
        });

        // 格式化消息记录
        const formattedMessages = messages
          .reverse() 
          .map((msg, index) => {
            const senderName = msg.sender?.name || '未知';
            const senderRole = msg.sender?.role || '未知';
            
            let content = '';
            if (typeof msg.content === 'string') {
              content = msg.content;
            } else if (msg.content && typeof msg.content === 'object') {
              try {
                const jsonContent = msg.content as any;
                if (jsonContent.content && Array.isArray(jsonContent.content)) {
                  content = jsonContent.content
                    .map((node: any) => {
                      if (node.type === 'paragraph' && node.content) {
                        return node.content
                          .map((textNode: any) => textNode.text || '')
                          .join('');
                      }
                      return '';
                    })
                    .join('\n');
                } else {
                  content = JSON.stringify(jsonContent);
                }
              } catch (e) {
                content = JSON.stringify(msg.content);
              }
            }
            
            const time = new Date(msg.createdAt).toLocaleString();
            return `${index + 1}. [${senderName}(${senderRole})] ${time}\n   ${content}`;
          })
          .join('\n\n');

        // 处理工单描述
        let descriptionText = '';
        if (ticket.description) {
          if (typeof ticket.description === 'string') {
            descriptionText = ticket.description;
          } else {
            try {
              const desc = ticket.description as any;
              if (desc.content && Array.isArray(desc.content)) {
                descriptionText = desc.content
                  .map((node: any) => {
                    if (node.type === 'paragraph' && node.content) {
                      return node.content
                        .map((textNode: any) => textNode.text || '')
                        .join('');
                    }
                    return '';
                  })
                  .join('\n');
              } else {
                descriptionText = JSON.stringify(desc);
              }
            } catch (e) {
              descriptionText = JSON.stringify(ticket.description);
            }
          }
        }

        const rawData = {
          userId: customer?.id?.toString() || '未知',
          userName: customer?.name || '未知',
          namespace: ticket.sealosNamespace || '无',
          region: ticket.area || '无',
          ticketId: ticket.id,
          priority: ticket.priority || '无',
          status: ticket.status,
          title: ticket.title || '无标题',
          description: descriptionText || '无描述',
          recentMessages: formattedMessages || '无对话记录',
          createdAt: new Date(ticket.createdAt).toLocaleString(),
          category: ticket.category || '无',
          module: ticket.module || '无',
        };
        
        console.log('🔍 Debug - final rawData.userId:', rawData.userId, 'userName:', rawData.userName);

        return c.json({
          success: true,
          data: rawData,
        });
      } catch (error: any) {
        console.error("获取上下文数据失败:", error);
        return c.json(
          { 
            success: false, 
            error: error.message || "获取数据失败，请重试" 
          },
          500
        );
      }
    },
  )

  // 整理工单上下文 - 修正API路径
  .post(
    "/ai-organize",
    describeRoute({
      tags: ["Optimize"],
      summary: "整理工单上下文",
      description: "第二步：使用AI整理工单上下文信息，生成结构化的技术工单摘要",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "成功整理上下文",
          content: {
            "application/json": { schema: resolver(organizeContextResponseSchema) },
          },
        },
      },
    }),
    zValidator("json", organizeContextSchema),
    async (c) => {
      const { rawData } = c.req.valid("json");

      try {
        if (!rawData) {
          return c.json({ 
            success: false, 
            error: "缺少原始数据，请先调用 get-context-data 接口" 
          }, 400);
        }

        const organizedText = await organizeContextWithAI(rawData);

        return c.json({
          success: true,
          data: {
            organizedText,
          },
        });
      } catch (error: any) {
        console.error("整理上下文失败:", error);
        return c.json(
          { 
            success: false, 
            error: error.message || "整理上下文失败，请重试" 
          },
          500
        );
      }
    },
  )

  // 优化文本
  .post(
    "/optimize-text",
    describeRoute({
      tags: ["Optimize"],
      summary: "优化文本",
      description: "第三步：使用AI优化客服回复文本，使其更加专业、清晰、友好",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "文本优化成功",
          content: {
            "application/json": { schema: resolver(optimizeTextResponseSchema) },
          },
        },
      },
    }),
    zValidator("json", optimizeTextSchema),
    async (c) => {
      const { originalText, ticketId, messageType, priority } = c.req.valid("json");
      const userId = c.var.userId;
      const role = c.var.role;

      console.log('🎯 Optimize API called:', { originalText, ticketId, messageType, userId, role });

      try {
        const db = connectDB();

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
            error: "工单不存在"
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
        });
        
        return c.json({
          success: true,
          ...result
        });

      } catch (error) {
        console.error("Text optimization error:", error);
        return c.json({
          success: false,
          error: "优化文本失败，请重试"
        }, 500);
      }
    }
  );

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
