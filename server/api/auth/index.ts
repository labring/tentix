import { connectDB } from "@/utils.ts";
import * as schema from "@db/schema.ts";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { getCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";

const authRouter = new Hono().post(
  "/login",
  describeRoute({
    description: "Login",
    tags: ["User"],
  }),
  zValidator(
    "query",
    z.object({
      callback: z.string().optional(),
      timestamp: z.string(),
    }),
  ),
  zValidator(
    "form",
    z.object({
      identity: z.string(),
      avatar: z.string(),
      name: z.string(),
      email: z.string(),
      level: z.string(),
      registerTime: z.string(),
      // sign: z.string(),
    }),
  ),
  async (c) => {
    const db = connectDB();
    const query = c.req.valid("query");
    const form = c.req.valid("form");

    const payload = Object.assign(form, {
      timestamp: query.timestamp,
      secret: process.env.SECRET,
    });

    const concated = Object.entries(payload)
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    // sign = md5(identity + avatar + name + email + level + timestamp + secret)
    // const sign = crypto.createHash('md5').update(concated).digest('hex');
    // if (sign !== form.sign) {
    // 	return c.json({ error: 'Invalid sign' }, 400);
    // }

    const { id: newUserId } = (
      await db
        .insert(schema.users)
        .values({
          name: form.name,
          identity: form.identity,
          avatar: form.avatar,
          registerTime: form.registerTime, // should be ISO string
          level: Number(form.level),
          email: form.email,
        })
        .returning({
          id: schema.users.id,
        })
    )[0]!;

    if (!newUserId) {
      throw new Error("Failed to create user");
    }

    await setSignedCookie(
      c,
      "identity",
      newUserId.toString(),
      process.env.SECRET!,
      {
        path: "/",
        secure: true,
        httpOnly: true,
        maxAge: 1000,
        expires: new Date(Date.now() + 30 * 60 * 60 * 24 * 30),
        sameSite: "Strict",
      },
    );

    const cookie = getCookie(c, "identity")!;

    await db.insert(schema.userSession).values({
      userId: newUserId,
      loginTime: new Date().toISOString(),
      userAgent: String(c.req.header("User-Agent")),
      cookie,
    });

    if (query.callback) {
      const url = new URL(query.callback, new URL(c.req.url).origin);
      return c.redirect(url, 301);
    }

    return c.json({ message: "Login successful" });
  },
);

export { authRouter };
