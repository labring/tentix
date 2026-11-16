import { logInfo } from "./log";

export type AuditEvent = {
  event: string;
  outcome: "success" | "rejected" | "error" | "signal";
  userId?: number;
  sessionId?: string;
  workflowId?: string;
  edgeIndex?: number;
  reason?: string;
  requestId?: string;
  ciphertextHash?: string;
  ivHash?: string;
};

export function securityAudit(event: AuditEvent) {
  logInfo(JSON.stringify({ ...event, time: new Date().toISOString() }));
}
