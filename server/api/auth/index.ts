import { areaEnumArray } from "@/utils/const.ts";
import { aesEncryptToString } from "@/utils/crypto";
import { connectDB } from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq } from "drizzle-orm";
import { Context } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { getConnInfo } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { factory, MyEnv } from "../middleware";

interface Data {
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

interface AuthResponse {
  code: number;
  message: string;
  data: Data;
}

export async function signBearerToken(
  c: Context<MyEnv>,
  id: number,
  role: string,
) {
  const cryptoKey = c.get("cryptoKey")();
  const now = new Date();
  const expireTime = Math.floor(now.getTime() / 1000) + 60 * 60 * 24 * 30;
  const ciphertext = await aesEncryptToString(
    `${id}##${role}##${expireTime}`,
    cryptoKey,
  );
  const token = `${ciphertext.ciphertext}+Tx*${ciphertext.iv}`;
  const connInfo = getConnInfo(c);
  const ip = connInfo.remote.address ?? "unknown";
  const db = c.get("db");
  await db.insert(schema.userSession).values({
    userId: id,
    loginTime: now.toUTCString(),
    userAgent: String(c.req.header("User-Agent")),
    ip,
    token,
  });
  return {
    token,
    expireTime,
  };
}

const authRouter = factory.createApp().get(
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
                token: z.string(),
                expireTime: z.number(),
              }),
            ),
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
    console.log("query", query);

    const authRes = await fetch(
      `https://${query.area}.sealos.run/api/auth/info`,
      {
        method: "POST",
        headers: {
          // Authorization: `${query.token}`,
          Authorization: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3b3Jrc3BhY2VVaWQiOiIwYjVkOTVmYi1mODllLTRjNWQtOWQ0NC1hM2E3MzZjNDNkZTAiLCJ3b3Jrc3BhY2VJZCI6Im5zLWYwbGhzd3BoIiwicmVnaW9uVWlkIjoiZjhmZTBmOTctNDU1MC00NzJmLWFhOWEtNzJlZDM0ZTYwOTUyIiwidXNlckNyVWlkIjoiNTAzZGNlMmItYmE4Ny00Yjk2LWJiYzYtMWFmNjhjMjc5OTk0IiwidXNlckNyTmFtZSI6IjE2MGN2OHoyIiwidXNlcklkIjoiOFVfNFdaaXV3bCIsInVzZXJVaWQiOiJmYTFmYzgzOC02ZTRjLTQ3Y2YtYmYyYi05Zjc5ZjZkMzZjYjIiLCJpYXQiOjE3NDk0Nzk3MjEsImV4cCI6MTc1MDA4NDUyMX0.5Gj4OQ5VILs_5RRzTKDf9YKp_-ixfj0MX1GdagxQUb4`,
        },
      },
    );
    console.log("authRes", authRes);
    console.log("authRes.ok", authRes.ok);
    const authResJson: AuthResponse = await authRes.json();
    console.log("authResJson", authResJson);
    if (!authRes.ok && authResJson.data !== null) {
      throw new HTTPException(401, {
        message: "Unauthorized",
        cause: authResJson.message,
      });
    }
    const info = authResJson.data.info;
    // const baseUrl = new URL(c.req.url).origin;

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
            realName: info?.realName ?? "",
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

    const tokenInfo = await signBearerToken(c, userInfo.id, userInfo.role);
    console.log("tokenInfo", tokenInfo.token);

    return c.json({
      id: userInfo.id,
      uid: info.uid,
      role: userInfo.role,
      ...tokenInfo,
    });
  },
);

export { authRouter };
