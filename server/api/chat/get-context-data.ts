import { factory, authMiddleware } from "../middleware.ts";
import { describeRoute } from "hono-openapi";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { connectDB } from "@/utils/tools.ts";
import * as schema from "@/db/schema.ts";
import { eq, and, desc } from "drizzle-orm";

const getContextDataSchema = z.object({
  ticketId: z.string(),
});

export const getContextDataRouter = factory
  .createApp()
  .use(authMiddleware)
  .post(
    "/get-context-data",
    describeRoute({
      tags: ["Chat"],
      summary: "获取工单基础数据",
      description: "第一步：获取工单的基础信息，包括用户信息、工单详情和对话记录",
    }),
    zValidator("json", getContextDataSchema),
    async (c) => {
      const { ticketId } = c.req.valid("json");
      const db = connectDB();

      try {
        // 获取工单信息
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
        const customer = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, ticket.customerId),
          columns: {
            id: true,
            name: true,
            sealosId: true,
          },
        });

        // 获取最近的对话消息
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

        // 格式化最近对话记录
        const formattedMessages = messages
          .reverse() // 按时间正序显示
          .map((msg, index) => {
            const senderName = msg.sender?.name || '未知';
            const senderRole = msg.sender?.role || '未知';
            
            // 处理消息内容
            let content = '';
            if (typeof msg.content === 'string') {
              content = msg.content;
            } else if (msg.content && typeof msg.content === 'object') {
              // 如果是JSON格式，尝试提取文本内容
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

        // 构建基础数据
        const rawData = {
          userId: customer?.sealosId || customer?.id?.toString() || '未知',
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
  );
