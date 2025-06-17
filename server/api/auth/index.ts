import { areaEnumArray } from "@/utils/const.ts";
import { aesEncryptToString } from "@/utils/crypto";
import { connectDB, SealosJWT } from "@/utils/index.ts";
import * as schema from "@db/schema.ts";
import { eq } from "drizzle-orm";
import { Context } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { getConnInfo } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { factory, MyEnv } from "../middleware";
import { isJWTExpired, parseSealosJWT } from "@/utils/jwt";

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

const authRouter = factory.createApp().post(
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
    "json",
    z.object({
      token: z.string(),
      area: z.enum(areaEnumArray),
      userInfo: z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string(),
        k8sUsername: z.string(),
        nsid: z.string(),
      }),
    }),
  ),
  async (c) => {
    const db = connectDB();
    const payload = c.req.valid("json");
    console.log("payload", payload);
    const { token, area, userInfo: userInfoPayload } = payload;

    if (isJWTExpired(token)) {
      throw new HTTPException(401, {
        message: "Unauthorized",
        cause: "Token expired",
      });
    }
    let sealosJwtPayload: SealosJWT;
    try {
      sealosJwtPayload = parseSealosJWT(token);
    } catch (error) {
      throw new HTTPException(401, {
        message: "Unauthorized",
        cause: "Token invalid",
      });
    }

    const userInfo = await (async () => {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.uid, sealosJwtPayload.userUid),
      });
      if (user === undefined) {
        const [newUser] = await db
          .insert(schema.users)
          .values({
            uid: sealosJwtPayload.userUid,
            name: userInfoPayload.name,
            nickname: "",
            realName: "",
            identity: userInfoPayload.id,
            avatar: userInfoPayload.avatar,
            registerTime: new Date().toISOString(),
            level: 1,
            role: "customer",
            email: "",
            phoneNum: "",
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
      uid: userInfo.uid,
      role: userInfo.role,
      ...tokenInfo,
    });
  },
);

export { authRouter };
