import { areaEnumArray, COOKIE_EXPIRY_TIME } from "@/utils/const.ts";
import { AppConfig, connectDB, refreshStaffMap } from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq } from "drizzle-orm";
import { Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { getCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";
import { resolver } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { getConnInfo } from "hono/bun";
export interface Data {
  info: {
    uid: string;
    createdAt: string;
    updatedAt: string;
    avatarUri: string;
    nickname: string;
    id: string;
    name: string;
    status: string;
    oauthProvider: {
      providerType: string;
      providerId: string;
    }[];
    realName: string;
  };
}

export interface AuthResponse {
  code: number;
  message: string;
  data: Data;
}


export async function setMyCookie(c: Context, id: number, role: string) {
  await setSignedCookie(
    c,
    "identity",
    `${id}===${role}`,
    process.env.SECRET!,
    {
      path: "/",
      secure: true,
      httpOnly: true,
      maxAge: 1000,
      expires: new Date(Date.now() + COOKIE_EXPIRY_TIME),
      sameSite: "Strict",
    },
  );

  const connInfo = getConnInfo(c);
  const ip = connInfo.remote.address ?? "unknown";

  const db = connectDB();
  await db.insert(schema.userSession).values({
    userId: id,
    loginTime: new Date().toUTCString(),
    userAgent: String(c.req.header("User-Agent")),
    ip,
  });
}

const authRouter = new Hono().get(
  "/login",
  describeRoute({
    description: "Login",
    tags: ["User"],
    responses: {
      200: {
        description: "Login success",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                id: z.string(),
                uid: z.string(),
                role: z.string(),
              }),
            ),
          },
        },
        headers: {
          "Set-Cookie": {
            // type: "string",
            description: "Set the identity cookie",
            example: "identity=1234567890",
          },
        },
      },
    },
  }),
  zValidator(
    "query",
    z.object({
      token: z.string(),
      area: z.enum(areaEnumArray),
    }),
  ),
  async (c) => {
    const db = connectDB();
    const query = c.req.valid("query");

    const authRes = await fetch(
      `https://${query.area}.sealos.run/api/auth/info`,
      {
        method: "POST",
        headers: {
          Authorization: `${query.token}`,
        },
      },
    );
    const authResJson: AuthResponse = await authRes.json();
    if (!authRes.ok && authResJson.data !== null) {
      throw new HTTPException(401, {
        message: "Unauthorized",
        cause: authResJson.message,
      });
    }
    const info = authResJson.data.info;
    const baseUrl = new URL(c.req.url).origin;

    const userInfo = await (async () => {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.uid, info.uid),
      });
      if (user === undefined) {
        const [newUser] = await db
          .insert(schema.users)
          .values({
            uid: info.uid,
            name: info.name,
            nickname: info.nickname,
            realName: info.realName,
            identity: info.id,
            avatar: info.avatarUri,
            registerTime: info.createdAt,
            level: 1,
            role: "customer",
            email:
              info.oauthProvider.find(
                (provider) => provider.providerType === "EMAIL",
              )?.providerId || "",
            phoneNum:
              info.oauthProvider.find(
                (provider) => provider.providerType === "PHONE",
              )?.providerId || "",
          })
          .returning();

        if (!newUser) {
          throw new Error("Failed to create user");
        }
        return newUser;
      }
      return user;
    })();

    await setMyCookie(c, userInfo.id, userInfo.role);

    return c.json({
      id: userInfo.id,
      uid: info.uid,
      role: userInfo.role,
    });
  },
);

export { authRouter };
