import { afterEach, expect, test } from "bun:test";
import { WSContext } from "hono/ws";
import { createGuardedSocket, disposeGuardedSocket, refreshGuardedSocket } from "../utils/session-connection";
import { RoomEmitter, RoomObserveEmitter } from "../utils/pubSub";
import type { SSEStreamingApi } from "hono/streaming";
import type { ServerWebSocket } from "bun";

const guarded: WSContext[] = [];
const originalDb = global.db;
afterEach(() => {
  for (const ws of guarded.splice(0)) disposeGuardedSocket(ws);
  global.db = originalDb;
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
test("workflow test socket closes during verification without unhandled rejection or restarted heartbeat", async () => {
  // 子进程隔离初次认证及外部依赖 mock，真实后台路由、Hono 回调和 guard 均参与执行。
  const script = `
    import { mock } from "bun:test";
    import { Hono } from "hono";
    import * as session from "./utils/session";
    import { websocket } from "./utils/websocket";
    const real = { ...session };
    const identity = { v: 2, userId: 1, role: "admin", sessionId: crypto.randomUUID(),
      tokenVersion: 0, expireTime: Math.floor(Date.now() / 1000) + 60 };
    mock.module("./utils/session", () => ({ ...real, authenticateSession: async () => identity }));
    mock.module("./utils/index.ts", () => ({ detectLocale: () => "en", logInfo: () => {},
      logError: () => {}, logWarning: () => {}, textToTipTapJSON: () => {} }));
    mock.module("./utils/file-validation.ts", () => ({ FileValidationError: Error,
      FileValidationUnavailableError: Error, validateContentAttachments: () => {} }));
    mock.module("./utils/kb/workflow-cache.ts", () => ({ workflowCache: {}, getAIResponse: () => {} }));
    const { chatRouter } = await import("./api/admin/chat.ts");
    process.on("unhandledRejection", (error) => { console.error(error); process.exit(2); });
    setTimeout(() => { console.error("verification did not finish"); process.exit(3); }, 2000);
    let release, entered, data;
    let closed = false;
    let intervalsAfterClose = 0;
    const sent = [];
    const originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = (...args) => {
      if (closed) intervalsAfterClose += 1;
      return originalSetInterval(...args);
    };
    const pending = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { entered = resolve; });
    global.db = { select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => {
      entered(); await pending;
      return [{ user: { role: "admin", tokenVersion: 0, forceRelogin: false },
        session: { tokenVersion: 0, revokedAt: null, expiresAt: new Date(identity.expireTime * 1000).toISOString() } }];
    } }) }) }) };
    const app = new Hono().use("*", async (c, next) => {
      c.set("db", global.db); c.set("cryptoKey", () => null);
      c.set("i18n", { getFixedT: () => (value) => value }); await next();
    }).route("/", chatRouter);
    await app.request("/chat?workflowId=test&ticketId=test&token=test", {}, {
      server: { upgrade: (_request, options) => { data = options.data; return true; } },
    });
    const raw = { data, readyState: 1, close() {}, send(value) { sent.push(value); } };
    websocket.open(raw);
    await started;
    closed = true;
    raw.readyState = 3;
    websocket.close(raw, 1000, "page closed");
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    console.log(JSON.stringify({ messages: sent.length, intervalsAfterClose }));
    process.exit(0);
  `;
  const child = Bun.spawn([process.execPath, "--eval", script], {
    cwd: `${import.meta.dir}/..`, stdout: "pipe", stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(JSON.parse(stdout)).toEqual({ messages: 0, intervalsAfterClose: 0 });
});
test.each(["session", "authorization"] as const)("closing during %s verification cannot leave a staff member in the room", async (phase) => {
  const expireTime = Math.floor(Date.now() / 1000) + 60;
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  // 仅模拟数据库结果和传输层，延迟对应校验；连接和房间管理使用真实实现。
  global.db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => {
      if (phase === "session") { entered(); await pending; }
      return [{
        user: { role: "agent", tokenVersion: 0, forceRelogin: false },
        session: { tokenVersion: 0, revokedAt: null, expiresAt: new Date(expireTime * 1000).toISOString() },
      }];
    } }) }) }),
  } as unknown as NonNullable<typeof global.db>;
  const raw = new WSContext<ServerWebSocket<undefined>>({ readyState: 1, send: () => {}, close: () => {} });
  const ws = createGuardedSocket(raw, {
    v: 2, userId: 1, sessionId: crypto.randomUUID(), tokenVersion: 0, expireTime,
  }, async () => {
    if (phase === "authorization") { entered(); await pending; }
    return "deliver";
  });
  guarded.push(ws);
  const emitter = new RoomEmitter();
  const event = { clientId: crypto.randomUUID(), roomId: "review-room", userId: 1, role: "agent" as const, ws };
  const opening = refreshGuardedSocket(ws).then((identity) => {
    emitter.emit("user_join", { ...event, role: identity.role });
    return "joined";
  }, (error: unknown) => (error as { reason: string }).reason);
  await started;
  disposeGuardedSocket(ws);
  release();
  try {
    expect(await opening).toBe("connection_closed");
    expect(emitter.hasRoleInRoom(event.roomId, "agent")).toBe(false);
    expect(emitter.roomsMap.has(event.roomId)).toBe(false);
  } finally {
    if (emitter.roomsMap.get(event.roomId)?.has(event.clientId)) emitter.emit("user_leave", event);
  }
});
test("leaving before joining or leaving twice is safe and preserves other members", () => {
  const emitter = new RoomEmitter();
  const sent: unknown[] = [];
  const ws = new WSContext<ServerWebSocket<undefined>>({ readyState: 1, send: (data) => { sent.push(data); }, close: () => {} });
  const staff = { clientId: crypto.randomUUID(), roomId: "review-room", userId: 1, role: "agent" as const, ws };
  const customer = { ...staff, clientId: crypto.randomUUID(), userId: 2, role: "customer" as const };
  expect(() => emitter.emit("user_leave", staff)).not.toThrow();
  expect(emitter.roomsMap.size).toBe(0);
  try {
    emitter.emit("user_join", customer);
    emitter.emit("user_join", staff);
    expect(emitter.hasRoleInRoom(staff.roomId, "agent")).toBe(true);
    emitter.emit("user_leave", staff);
    expect(emitter.hasRoleInRoom(staff.roomId, "agent")).toBe(false);
    expect(emitter.hasRoleInRoom(staff.roomId, "customer")).toBe(true);
    const count = sent.length;
    emitter.emit("user_leave", staff);
    expect(sent).toHaveLength(count);
    expect(emitter.connectionStates.has(customer.clientId)).toBe(true);
    emitter.emit("user_leave", customer);
    expect(() => emitter.emit("user_leave", customer)).not.toThrow();
    expect(emitter.roomsMap.size).toBe(0);
    expect(emitter.roomUserRoles.size).toBe(0);
    expect(emitter.connectionStates.size).toBe(0);
  } finally {
    for (const event of [staff, customer]) {
      if (emitter.roomsMap.get(event.roomId)?.has(event.clientId)) emitter.emit("user_leave", event);
    }
  }
});
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
