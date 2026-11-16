import { expect, test } from "bun:test";
import { compileCondition } from "../utils/kb/workflow-condition";
import { validateWorkflow, WorkflowNodesSchema } from "../utils/workflow-schema";
import { resolveWorkflowApiKey } from "../utils/workflow-secret";
import { NodeType, WorkflowEdgeType } from "../utils/const";

const nodes = [
  { id: "start", name: "Start", type: NodeType.START as const },
  { id: "end", name: "End", type: NodeType.END as const },
];
const edge = { id: "edge", type: WorkflowEdgeType.CONDITION, source: "start", target: "end",
  condition: "handoffRequired === true" };

test("existing scalar conditions preserve all four combinations", () => {
  const handoff = compileCondition("handoffRequired === true");
  const escalation = compileCondition("proposeEscalation === true");
  for (const a of [false, true]) for (const b of [false, true]) {
    const values = { handoffRequired: a, proposeEscalation: b };
    expect(handoff(values)).toBe(a);
    expect(escalation(values)).toBe(b);
  }
});
test("all AST branches reject execution and object access before evaluation", () => {
  for (const expression of [
    "process.exit()", "globalThis.process", "({}).constructor", "a = true",
    "true || process.exit()", "false && fetch('https://invalid.example')",
    "true ? true : (() => 1)()", "import('fs')", "new Function('return 1')()",
    "a; b", "currentTicket", "handoffRequired['x']",
  ]) expect(() => compileCondition(expression)).toThrow();
});
test("getters, inherited fields and object values cannot execute", () => {
  let called = false;
  const values = Object.defineProperty({}, "handoffRequired", { get() { called = true; return true; } });
  expect(() => compileCondition("handoffRequired")(values)).toThrow();
  expect(called).toBe(false);
  expect(() => compileCondition("x")(Object.create({ x: true }))).toThrow();
  expect(() => compileCondition("x")({ x: {} })).toThrow();
});
test("graph validation checks duplicate edges and unreachable malicious branches", () => {
  expect(() => validateWorkflow(nodes, [edge, edge])).toThrow();
  expect(() => validateWorkflow(nodes, [{ ...edge, type: WorkflowEdgeType.NORMAL }])).toThrow();
  expect(() => validateWorkflow(nodes, [{ ...edge, source: "missing", condition: "process.exit()" }])).toThrow();
  expect(() => compileCondition("x".repeat(1025))).toThrow();
  expect(() => compileCondition("!".repeat(17) + "true")).toThrow();
});
test("smartChat saves default-disabled vision without inserting configuration", () => {
  const draft = [{ id: "chat", name: "Chat", type: NodeType.SMART_CHAT as const,
    config: { systemPrompt: "System", userPrompt: "User" } }];
  const parsed = WorkflowNodesSchema.parse(draft);
  expect(parsed).toEqual(draft);
  expect(parsed[0]!.config).not.toHaveProperty("enableVision");
  expect(WorkflowNodesSchema.safeParse([{ ...draft[0],
    config: { ...draft[0]!.config, enableVision: "false" } }]).success).toBe(false);
});
test("smartChat preserves legacy RAG metadata without allowing unknown fields", () => {
  const config = { systemPrompt: "System", userPrompt: "User", enableRAG: true,
    ragConfig: { enableIntentAnalysis: false, intentAnalysisUserPrompt: "Intent user",
      intentAnalysisSystemPrompt: "Intent system", generateSearchQueriesUserPrompt: "Search user",
      generateSearchQueriesSystemPrompt: "Search system" } };
  const draft = [{ id: "chat", name: "Chat", type: NodeType.SMART_CHAT as const, config }];
  expect(WorkflowNodesSchema.parse(draft)).toEqual(draft);
  expect(WorkflowNodesSchema.safeParse([{ ...draft[0],
    config: { ...config, enableRAG: "true" } }]).success).toBe(false);
  expect(WorkflowNodesSchema.safeParse([{ ...draft[0],
    config: { ...config, ragConfig: { ...config.ragConfig, unknown: "value" } } }]).success).toBe(false);
});
test("schema preserves editor fields and absent start/end configuration", () => {
  const fixture = nodes.map((node) => ({ ...node, position: { x: 1, y: 2 },
    handles: [{ id: "h", position: "bottom" as const, type: "source" as const, condition: "" }] }));
  expect(WorkflowNodesSchema.parse(fixture)).toEqual(fixture);
  expect(WorkflowNodesSchema.safeParse([{ ...nodes[0], arbitrary: true }]).success).toBe(false);
});
test("only four fixed Secret aliases resolve and missing values fail closed", () => {
  const name = "TENTIX_AI_EMOTION_KEY";
  const previous = process.env[name];
  try {
    process.env[name] = "isolated-test-value";
    expect(resolveWorkflowApiKey("secret:emotion")).toBe("isolated-test-value");
    expect(resolveWorkflowApiKey("")).toBeUndefined();
    expect(() => resolveWorkflowApiKey("secret:ENCRYPTION_KEY")).toThrow();
    expect(() => resolveWorkflowApiKey("plaintext-key")).toThrow();
    delete process.env[name];
    expect(() => resolveWorkflowApiKey("secret:emotion")).toThrow();
  } finally {
    if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
  }
});
