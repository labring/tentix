import { WSContext } from "hono/ws";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { membersCols } from "@/api/queryParams";
import { connectDB } from "./tools";
import { assertActiveSession, SessionError, type SessionIdentity, type SessionPayload } from "./session";
import { securityAudit } from "./security-audit";

type Decision = "deliver" | "skip" | "close";
type Authorize = (identity: SessionIdentity, message?: unknown) => Promise<Decision>;
type GuardState = { refresh: () => Promise<SessionIdentity>; dispose: () => void };
const guardStates = new WeakMap<WSContext, GuardState>();

export async function canAccessTicket(identity: SessionIdentity, ticketId: string) {
  if (identity.role !== "customer") return true;
  const ticket = await connectDB().query.tickets.findFirst({
    where: eq(schema.tickets.id, ticketId), with: { ...membersCols },
  });
  return !!ticket && [ticket.customer, ticket.agent, ...ticket.technicians.map((entry) => entry.user)]
    .some((user) => user.id === identity.userId);
}

export function createGuardedSocket<T>(ws: WSContext<T>, identity: SessionPayload, authorize: Authorize) {
  let stopped = false;
  let pending = 0;
  let tail = Promise.resolve();
  let timer: ReturnType<typeof setInterval>;
  const dispose = () => {
    stopped = true;
    clearInterval(timer);
  };
  const close = (code = 1008, reason = "Session unavailable") => {
    if (stopped) return;
    dispose();
    ws.close(code, reason);
    securityAudit({ event: "connection.revoked", outcome: "rejected", userId: identity.userId, sessionId: identity.sessionId });
  };
  const verify = async (message?: unknown) => {
    if (stopped) throw new SessionError("connection_closed");
    const current = await assertActiveSession(connectDB(), identity);
    const decision = await authorize(current, message);
    if (decision === "close") throw new SessionError("forbidden");
    return { current, decision };
  };
  const guarded = new WSContext<T>({
    raw: ws.raw, url: ws.url, protocol: ws.protocol,
    get readyState() { return ws.readyState; },
    close,
    send(data, options) {
      if (stopped) return;
      if (pending >= 64) { close(1013, "Slow connection"); return; }
      pending += 1;
      tail = tail.then(async () => {
        if (stopped || ws.readyState !== 1) return;
        let message: unknown;
        if (typeof data === "string") {
          try { message = JSON.parse(data); } catch { message = undefined; }
        }
        const { decision } = await verify(message);
        if (!stopped && decision === "deliver" && ws.readyState === 1) ws.send(data, options);
      }).catch((error: unknown) => {
        close(error instanceof SessionError ? 1008 : 1011, "Session verification failed");
      }).finally(() => { pending -= 1; });
    },
  });
  guardStates.set(guarded, {
    refresh: async () => {
      try { return (await verify()).current; }
      catch (error) { close(error instanceof SessionError ? 1008 : 1011); throw error; }
    },
    dispose,
  });
  timer = setInterval(() => {
    void verify().catch(() => close());
  }, 10000);
  return guarded;
}

export function refreshGuardedSocket(ws: WSContext) {
  const state = guardStates.get(ws);
  if (!state) throw new SessionError("connection_missing");
  return state.refresh();
}

export function disposeGuardedSocket(ws: WSContext | undefined) {
  if (!ws) return;
  guardStates.get(ws)?.dispose();
  guardStates.delete(ws);
}

export function isInternalMessage(message: unknown) {
  return !!message && typeof message === "object" && (message as { isInternal?: unknown }).isInternal === true;
}
