import { afterAll, beforeAll, expect, test } from "bun:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import * as relations from "../db/relations";
import { generateAesKey } from "../utils/crypto";
import {
  createSession, createSessionInTransaction, authenticateSession, decryptSessionPayload,
  revokeCurrentSession, revokeUserSessions, tokenDigest,
} from "../utils/session";

// 只允许显式指定的本机隔离库；运行前在该库应用本次结构脚本。
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required");
const parsed = new URL(url);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) ||
    !/^\/tentix_security_test(?:_[a-z0-9]+)?$/.test(parsed.pathname)) {
  throw new Error("Use a local tentix_security_test database");
}
const pool = new Pool({ connectionString: url });
const db = drizzle({ client: pool, schema: { ...schema, ...relations } });
const ids: number[] = [];
let userId: number;
let key: CryptoKey;
const client = { ip: "127.0.0.1", userAgent: "security-integration-test" };
beforeAll(async () => {
  key = await generateAesKey();
  const [user] = await db.insert(schema.users).values({
    registerTime: new Date().toISOString(), name: "session-security-test",
  }).returning();
  userId = user!.id;
  ids.push(userId);
});
afterAll(async () => {
  try {
    for (const id of ids) {
      await db.delete(schema.userSession).where(eq(schema.userSession.userId, id));
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
  } finally { await pool.end(); }
});
test("database stores a digest and independently revokes one of two sessions", async () => {
  const a = await createSession(db, key, userId, client);
  const b = await createSession(db, key, userId, client);
  const identity = await authenticateSession(db, key, a.token);
  const saved = await db.query.userSession.findFirst({ where: eq(schema.userSession.sessionId, identity.sessionId) });
  expect(saved!.tokenHash).toBe(await tokenDigest(a.token));
  expect(saved!.tokenHash).not.toBe(a.token);
  expect(Object.hasOwn(saved!, "token")).toBe(false);
  await revokeCurrentSession(db, identity.sessionId);
  await expect(authenticateSession(db, key, a.token)).rejects.toThrow();
  expect((await authenticateSession(db, key, b.token)).userId).toBe(userId);
});
test("role change revokes every old session and new sessions read current role", async () => {
  const a = await createSession(db, key, userId, client);
  const b = await createSession(db, key, userId, client);
  await db.transaction(async (tx) => {
    await revokeUserSessions(tx, userId);
    await tx.update(schema.users).set({ role: "agent" }).where(eq(schema.users.id, userId));
  });
  for (const old of [a, b]) await expect(authenticateSession(db, key, old.token)).rejects.toThrow();
  const fresh = await createSession(db, key, userId, client);
  expect((await authenticateSession(db, key, fresh.token)).role).toBe("agent");
});
test("rolled-back user revocation and signing leave no partial session state", async () => {
  const old = await createSession(db, key, userId, client);
  let rolledBackToken = "";
  await expect(db.transaction(async (tx) => {
    await revokeUserSessions(tx, userId);
    rolledBackToken = (await createSessionInTransaction(tx, key, userId, client)).token;
    throw new Error("rollback-fixture");
  })).rejects.toThrow("rollback-fixture");
  expect((await authenticateSession(db, key, old.token)).userId).toBe(userId);
  await expect(authenticateSession(db, key, rolledBackToken)).rejects.toThrow();
});
test("token version, format, nonce and ciphertext tampering are rejected", async () => {
  const session = await createSession(db, key, userId, client);
  const payload = await decryptSessionPayload(session.token, key);
  const parts = session.token.split(".");
  for (const index of [1, 2]) {
    const changed = [...parts];
    const bytes = Buffer.from(parts[index]!, "base64url");
    bytes[0] = bytes[0]! ^ 1;
    changed[index] = bytes.toString("base64url");
    await expect(authenticateSession(db, key, changed.join("."))).rejects.toThrow();
  }
  for (const token of ["old+Tx*iv", "v3.a.b", session.token + ".extra"]) {
    await expect(authenticateSession(db, key, token)).rejects.toThrow();
  }
  await db.update(schema.users).set({ tokenVersion: payload.tokenVersion + 1 }).where(eq(schema.users.id, userId));
  await expect(authenticateSession(db, key, session.token)).rejects.toThrow();
});
