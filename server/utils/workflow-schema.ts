import { z } from "zod";
import { WorkflowEdgeType } from "./const";
import { compileCondition, compileWorkflowConditions } from "./kb/workflow-condition";
import { assertWorkflowSecretReferences } from "./workflow-secret";
import { WorkflowNodesSchema } from "./workflow-node-schema";
export { WorkflowNodeSchema, WorkflowNodesSchema } from "./workflow-node-schema";
import { securityAudit } from "./security-audit";


export function auditConditionSignals(expression: unknown, workflowId?: string, edgeIndex?: number) {
  if (typeof expression !== "string") return;
  const hasSignal = /(?:process|child_process|require|import|constructor|globalThis|Bun|Deno|fetch|;|=>|\x60)/.test(expression);
  if (hasSignal || expression.length > 1024) {
    securityAudit({ event: "workflow.condition_signal", outcome: "signal", workflowId, edgeIndex,
      reason: expression.length > 1024 ? "length" : "syntax_signal" });
  }
}

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1), type: z.nativeEnum(WorkflowEdgeType),
  source: z.string().min(1), target: z.string().min(1),
  source_handle: z.string().optional(), target_handle: z.string().optional(),
  condition: z.string().max(1024).optional(),
}).strict().superRefine((edge, context) => {
  if (edge.type === WorkflowEdgeType.CONDITION && !edge.condition?.trim()) {
    context.addIssue({ code: "custom", path: ["condition"], message: "Condition is required" });
  }
  if (edge.type === WorkflowEdgeType.NORMAL && edge.condition) {
    context.addIssue({ code: "custom", path: ["condition"], message: "Unexpected condition" });
  }
  if (edge.condition) {
    try { compileCondition(edge.condition); }
    catch { context.addIssue({ code: "custom", path: ["condition"], message: "Invalid condition" }); }
  }
});
export const WorkflowEdgesSchema = z.array(WorkflowEdgeSchema).max(1024);

export function validateWorkflow(
  nodes: unknown[], edges: unknown[],
  translate: (key: string) => string = (key) => key,
  workflowId?: string,
) {
  edges.forEach((edge, index) => {
    auditConditionSignals(edge && typeof edge === "object" ? (edge as {condition?: unknown}).condition : undefined, workflowId, index);
  });
  const parsed = z.object({ nodes: WorkflowNodesSchema, edges: WorkflowEdgesSchema }).strict().safeParse({ nodes, edges });
  if (!parsed.success) {
    securityAudit({ event: "workflow.condition_rejected", outcome: "rejected", workflowId, reason: "schema" });
    throw new Error("Invalid workflow at " + parsed.error.issues[0]!.path.join("."));
  }
  const ids = new Set<string>();
  for (const node of parsed.data.nodes) {
    if (ids.has(node.id)) throw new Error(translate("duplicate_node_id"));
    ids.add(node.id);
  }
  const edgeIds = new Set<string>();
  const adjacent = new Map<string, string[]>();
  for (const id of ids) adjacent.set(id, []);
  for (const edge of parsed.data.edges) {
    if (edgeIds.has(edge.id)) throw new Error("Duplicate edge id");
    edgeIds.add(edge.id);
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(translate("invalid_edge_reference"));
    adjacent.get(edge.source)!.push(edge.target);
  }
  const active = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) throw new Error(translate("invalid_edge_cycle"));
    if (done.has(id)) return;
    active.add(id);
    for (const next of adjacent.get(id)!) visit(next);
    active.delete(id);
    done.add(id);
  };
  for (const id of ids) visit(id);
  assertWorkflowSecretReferences(parsed.data.nodes);
  return compileWorkflowConditions(parsed.data.edges);
}
