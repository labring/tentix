import * as schema from "@db/schema.ts";
import { inArray } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { factory } from "../middleware.ts";
import { workflowRouter } from "./workflow.ts";
import { basicUserCols } from "../queryParams.ts";

const adminRouter = factory.createApp().get(
  "/staffList",
  describeRoute({
    description: "Get all staff members",
    tags: ["Admin"],
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
      where: inArray(schema.users.role, ["agent", "technician"]),
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
      };
    });

    return c.json(res);
  },
)
// 挂载工作流与 AI 角色配置相关路由
.route("/", workflowRouter);
export { adminRouter };
