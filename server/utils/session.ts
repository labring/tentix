import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { connectDB } from "./tools";
import { aesDecryptFromString, aesEncryptToString } from "./crypto";
import { securityAudit } from "./security-audit";

type Database = ReturnType<typeof connectDB>;
export type SessionTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Client = Database | SessionTransaction;
const payloadSchema = z.object({
  v: z.literal(2),
  userId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  sessionId: z.string().uuid(),
  tokenVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  expireTime: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();
export type SessionPayload = z.infer<typeof payloadSchema>;
export type SessionIdentity = SessionPayload & { role: typeof schema.users.$inferSelect.role };

export class SessionError extends Error {
  constructor(public readonly reason: string) {
    super("Unauthorized");
  }
}

function cleanToken(token: string) {
  const result = token.replace(/^Bearer\s+/i, "").trim();
  if (result.length > 4096) throw new SessionError("format");
  return result;
}

function decodePart(part: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new SessionError("format");
  const decoded = Buffer.from(part, "base64url");
  if (decoded.toString("base64url") !== part) throw new SessionError("format");
  return decoded;
}

export async function tokenDigest(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(hash).toString("hex");
}

export async function decryptSessionPayload(token: string, key: CryptoKey): Promise<SessionPayload> {
  const parts = cleanToken(token).split(".");
  if (parts.length !== 3 || parts[0] !== "v2") throw new SessionError("format");
  const iv = decodePart(parts[1]!);
  const ciphertext = decodePart(parts[2]!);
  if (iv.byteLength !== 12 || ciphertext.byteLength < 16) throw new SessionError("format");
  try {
    const plaintext = await aesDecryptFromString(ciphertext.toString("base64"), iv.toString("base64"), key);
    return payloadSchema.parse(JSON.parse(plaintext));
  } catch {
    throw new SessionError("integrity");
  }
}

export async function lockSessionUser(tx: SessionTransaction, userId: number) {
  const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).for("update");
  if (!user) throw new SessionError("user_missing");
  return user;
}

export async function createSessionInTransaction(
  tx: SessionTransaction,
  key: CryptoKey,
  userId: number,
  client: { ip: string; userAgent: string },
) {
  const user = await lockSessionUser(tx, userId);
  const expireTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const payload: SessionPayload = {
    v: 2, userId, sessionId: crypto.randomUUID(), tokenVersion: user.tokenVersion, expireTime,
  };
  const encrypted = await aesEncryptToString(JSON.stringify(payload), key);
  const token = ["v2", Buffer.from(encrypted.iv, "base64").toString("base64url"),
    Buffer.from(encrypted.ciphertext, "base64").toString("base64url")].join(".");
  await tx.insert(schema.userSession).values({
    userId, ...client, sessionId: payload.sessionId, tokenVersion: user.tokenVersion,
    tokenHash: await tokenDigest(token), expiresAt: new Date(expireTime * 1000).toISOString(),
    loginTime: new Date().toISOString(),
  });
  if (user.forceRelogin) {
    await tx.update(schema.users).set({ forceRelogin: false }).where(eq(schema.users.id, userId));
  }
  securityAudit({ event: "session.created", outcome: "signal", userId, sessionId: payload.sessionId });
  return { token, expireTime };
}

export function createSession(db: Database, key: CryptoKey, userId: number, client: { ip: string; userAgent: string }) {
  return db.transaction((tx) => createSessionInTransaction(tx, key, userId, client));
}

export async function assertActiveSession(db: Client, identity: SessionPayload): Promise<SessionIdentity> {
  if (identity.expireTime <= Date.now() / 1000) throw new SessionError("expired");
  const [row] = await db.select({ session: schema.userSession, user: schema.users })
    .from(schema.userSession).innerJoin(schema.users, eq(schema.users.id, schema.userSession.userId))
    .where(and(eq(schema.userSession.sessionId, identity.sessionId), eq(schema.userSession.userId, identity.userId)));
  if (!row || row.session.revokedAt || row.user.forceRelogin ||
      row.session.tokenVersion !== identity.tokenVersion || row.user.tokenVersion !== identity.tokenVersion ||
      Date.parse(row.session.expiresAt) !== identity.expireTime * 1000) {
    throw new SessionError("revoked");
  }
  return { ...identity, role: row.user.role };
}

export async function authenticateSession(db: Client, key: CryptoKey, token: string) {
  const clean = cleanToken(token);
  const payload = await decryptSessionPayload(clean, key);
  const identity = await assertActiveSession(db, payload);
  const session = await db.query.userSession.findFirst({
    where: and(eq(schema.userSession.sessionId, identity.sessionId), eq(schema.userSession.tokenHash, await tokenDigest(clean))),
    columns: { sessionId: true },
  });
  if (!session) throw new SessionError("digest");
  return identity;
}

export async function revokeCurrentSession(db: Client, sessionId: string) {
  await db.update(schema.userSession).set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.userSession.sessionId, sessionId), isNull(schema.userSession.revokedAt)));
  securityAudit({ event: "session.revoked", outcome: "success", sessionId });
}

export async function revokeUserSessions(tx: SessionTransaction, userId: number) {
  const user = await lockSessionUser(tx, userId);
  await tx.update(schema.users).set({ tokenVersion: user.tokenVersion + 1 }).where(eq(schema.users.id, userId));
  await tx.update(schema.userSession).set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.userSession.userId, userId), isNull(schema.userSession.revokedAt)));
  securityAudit({ event: "session.user_revoked", outcome: "signal", userId });
}
