import { afterEach, expect, test } from "bun:test";
import { WSContext } from "hono/ws";
import { createGuardedSocket, disposeGuardedSocket } from "../utils/session-connection";
import { RoomObserveEmitter } from "../utils/pubSub";
import type { SSEStreamingApi } from "hono/streaming";

const guarded: WSContext[] = [];
const originalDb = global.db;
afterEach(() => {
  for (const ws of guarded.splice(0)) disposeGuardedSocket(ws);
  global.db = originalDb;
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
test("queued socket sends recheck session and preserve order", async () => {
  let revokedAt: string | null = null;
  const expireTime = Math.floor(Date.now() / 1000) + 60;
  // 此用例模拟数据库返回和传输层；真实数据库撤销由 session-security 覆盖。
  global.db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => [{
      user: { role: "customer", tokenVersion: 0, forceRelogin: false },
      session: { tokenVersion: 0, revokedAt, expiresAt: new Date(expireTime * 1000).toISOString() },
    }] }) }) }),
  } as unknown as NonNullable<typeof global.db>;
  const sent: unknown[] = [];
  const closed: number[] = [];
  const raw = new WSContext({ readyState: 1, send: (data) => { sent.push(data); }, close: (code) => { closed.push(code ?? 1000); } });
  const ws = createGuardedSocket(raw, {
    v: 2, userId: 1, sessionId: crypto.randomUUID(), tokenVersion: 0, expireTime,
  }, async () => "deliver");
  guarded.push(ws);
  ws.send("one"); ws.send("two");
  await tick();
  expect(sent).toEqual(["one", "two"]);
  revokedAt = new Date().toISOString();
  ws.send("secret");
  await tick();
  expect(sent).toEqual(["one", "two"]);
  expect(closed).toContain(1008);
});
test("one user can retain two streams and skip internal messages without closing", async () => {
  const emitter = new RoomObserveEmitter();
  const a: string[] = [], b: string[] = [];
  const stream = (target: string[]) => ({
    closed: false, aborted: false,
    writeSSE: async (message: { event?: string; data: string }) => { target.push(message.data); },
    close: async () => {}, abort: () => {},
  }) as unknown as SSEStreamingApi;
  const authorize = async (_room: string, internal: boolean) => internal ? "skip" as const : "deliver" as const;
  const idA = emitter.register(1, stream(a), authorize);
  const idB = emitter.register(1, stream(b), authorize);
  emitter.observe(1, "room");
  const message = { roomId: "room", userId: 2, content: { type: "doc" },
    tempId: 1, messageId: 1, timestamp: Date.now(), isInternal: true };
  emitter.emit("new_message", message);
  emitter.emit("new_message", { ...message, messageId: 2, isInternal: false });
  await tick();
  expect(a).toHaveLength(1); expect(b).toHaveLength(1);
  emitter.unregister(1, idA);
  expect(emitter.isOnline(1)).toBe(true);
  emitter.emit("new_message", { ...message, messageId: 3, isInternal: false });
  await tick();
  expect(a).toHaveLength(1); expect(b).toHaveLength(2);
  emitter.unregister(1, idB);
  expect(emitter.isOnline(1)).toBe(false);
});
