import * as schema from "@db/schema.ts";
import { and, eq, inArray, ne } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { authMiddleware, factory } from "../middleware.ts";
import { basicUserCols } from "../queryParams.ts";

const raiseReqSchema = z.object({
  title: z.string(),
  description: z.string(),
  module: z.enum(schema.module.enumValues),
  priority: z.enum(schema.ticketPriority.enumValues),
  relatedTicket: z.string().optional(),
});

const adminRouter = factory
  .createApp()
  .get(
    "/staffList",
    describeRoute({
      description: "Get all staff members",
      tags: ["admin"],
      responses: {
        200: {
          description: "All staff members with their open tickets",
          content: {
            "application/json": {
              // schema will be defined here
            },
          },
        },
      },
    }),
    async (c) => {
      const db = c.var.db;
      const data = await db.query.users.findMany({
        ...basicUserCols,
        where: inArray(schema.users.role, [
          "agent",
          "technician",
        ]),
        
      });
      const staffMap = c.var.staffMap();
      const res = data.map((staff) => {
        return {
          ...staff,
          ticketNum: staffMap.get(staff.id)?.remainingTickets || 0,
          workload: (() => {
            const num = staffMap.get(staff.id)?.remainingTickets || 0;
            if (num < 5) return "Low";
            if (num < 10) return "Medium";
            return "High";
          })(),
          department: staffMap.get(staff.id)?.department || "Unknown",
        };
      });

      return c.json(res);
    },
  )
  .post(
    "/raiseReq",
    authMiddleware,
    describeRoute({
      description: "Raise a new requirement",
      tags: ["admin"],
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Requirement raised successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  message: z.string(),
                  requirementId: z.number(),
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator("json", raiseReqSchema),
    async (c) => {
      const db = c.var.db;
      const userId = c.var.userId;
      const userRole = c.var.role;
      const { title, description, module, priority, relatedTicket } =
        c.req.valid("json");

      try {
        // Check if the user is authorized to raise requirements
        if (userRole === "customer" && process.env.NODE_ENV === "production") {
          throw new HTTPException(400, {
            message: "You are not authorized to raise requirements",
          });
        }

        // Convert the description to JSONContent format
        const jsonContent = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description,
                },
              ],
            },
          ],
        };

        // Insert the new requirement
        const result = await db
          .insert(schema.requirements)
          .values({
            title,
            description: jsonContent,
            module,
            priority,
            relatedTicket: relatedTicket || null,
          })
          .returning({ id: schema.requirements.id });

        const requirementId = result[0]?.id || 0;

        // If there is a related ticket, add history record
        if (relatedTicket) {
          await db.insert(schema.ticketHistory).values({
            type: "makeRequest",
            meta: userId,
            description: title,
            ticketId: relatedTicket,
            operatorId: userId,
          });
        }

        return c.json({
          success: true,
          message: "Requirement raised successfully",
          requirementId,
        });
      } catch (error) {
        console.error("Raise requirement failed:", error);
        throw new HTTPException(500, {
          message: "Failed to raise requirement, please try again later",
        });
      }
    },
  )
  

export { adminRouter };
