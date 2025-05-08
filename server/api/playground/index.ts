import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getPresignedUrl, removeFile } from "@/utils/minio.ts";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";
import { factory } from "../middleware.ts";
import * as schema from "@db/schema.ts";
import { eq, inArray, sql, and, asc } from "drizzle-orm";
import { sendFeishuCard } from "@/utils/platform.ts";
import { refreshStaffMap } from "@/utils/tools.ts";
import { loremText } from "./spam.ts";
import { extractTextAsString, getAbbreviatedText } from "@/utils/types.ts";
const playgroundRouter = factory
  .createApp()
  .use(async (c, next) => {
    if (process.env.NODE_ENV !== "production") {
      await next();
    } else {
      return c.json({ error: "Not for production use." }, 403);
    }
  })
  .get(
    "/agentmap",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
      description: "Test endpoint. Not for production use.",
    }),
    async (c) => {
      const db = c.get("db");
      // Get all agents and their in-progress ticket counts
      const agents = await db
        .select({
          id: schema.users.id,
          inProgressCount: sql<number>`COUNT(${schema.ticketSession.id})`.as(
            "inProgressCount",
          ),
        })
        .from(schema.users)
        .leftJoin(
          schema.ticketSessionMembers,
          eq(schema.users.id, schema.ticketSessionMembers.userId),
        )
        .leftJoin(
          schema.ticketSession,
          and(
            eq(schema.ticketSessionMembers.ticketId, schema.ticketSession.id),
            eq(schema.ticketSession.status, "In Progress"),
          ),
        )
        .where(eq(schema.users.role, "agent"))
        .groupBy(schema.users.id)
        .orderBy(asc(sql<number>`COUNT(${schema.ticketSession.id})`));

      return c.json({ agents });
    },
  )
  .get(
    "/sendFeishuCard",
    describeRoute({
      tags: ["Playground"],
      hide: process.env.NODE_ENV === "production",
      description: "Test endpoint. Not for production use.",
    }),
    async (c) => {
      await refreshStaffMap(true);
      const staffMap = c.var.getStaffMap();
      const staffMapEntries = Array.from(staffMap.entries());
      const id = staffMapEntries[0]![1].feishuId;

      const description = getAbbreviatedText(loremText, 200);

      const res = await sendFeishuCard("new_ticket", {
        title: "Feishu Card SendTest",
        description: description,
        time: new Date().toLocaleString("zh-CN"),
        assignee: id,
        number: 1,
        ticket_url: {
          url: "http://localhost:3000/api/reference",
        },
      });
      return c.json({ ...res });
    },
  );

export { playgroundRouter };
