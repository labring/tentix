import { parse, type Node } from "acorn";
import type { WorkflowEdge } from "@/utils/const";

type Scalar = string | number | boolean | null | undefined;
type Reader = (variables: Record<string, unknown>) => Scalar;
type AstNode = Node & {
  body?: AstNode[];
  expression?: AstNode;
  argument?: AstNode;
  left?: AstNode;
  right?: AstNode;
  test?: AstNode;
  consequent?: AstNode;
  alternate?: AstNode;
  value?: unknown;
  name?: string;
  operator?: string;
  regex?: unknown;
  bigint?: string;
};

export type Condition = (variables: Record<string, unknown>) => boolean;

export function compileCondition(expression: string): Condition {
  if (expression.length > 1024 || expression.trim().length === 0) {
    throw new Error("Invalid condition length");
  }
  const program = parse(expression, { ecmaVersion: 2020 }) as AstNode;
  if (program.body?.length !== 1 || program.body[0]?.type !== "ExpressionStatement") {
    throw new Error("Expected one condition expression");
  }
  let nodes = 0;
  const visit = (node: AstNode, depth: number): Reader => {
    nodes += 1;
    if (nodes > 128 || depth > 16) throw new Error("Condition is too complex");
    switch (node.type) {
      case "Literal": {
        const value = node.value;
        if (node.regex || node.bigint || (value !== null && !["string", "number", "boolean"].includes(typeof value))) {
          throw new Error("Unsupported literal");
        }
        return () => value as Scalar;
      }
      case "Identifier": {
        const name = node.name!;
        if (["currentTicket", "retrievedContext", "ragTrace"].includes(name)) {
          throw new Error("Expected a scalar variable name");
        }
        return (variables) => {
          if (name === "undefined") return undefined;
          const descriptor = Object.getOwnPropertyDescriptor(variables, name);
          if (!descriptor) throw new Error("Unknown condition variable");
          if (!("value" in descriptor)) throw new Error("Unsupported variable");
          const value: unknown = descriptor.value;
          if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) {
            throw new Error("Expected a scalar variable");
          }
          return value as Scalar;
        };
      }
      case "UnaryExpression": {
        if (node.operator !== "!") throw new Error("Unsupported unary operator");
        const argument = visit(node.argument!, depth + 1);
        return (variables) => !argument(variables);
      }
      case "LogicalExpression": {
        if (node.operator !== "&&" && node.operator !== "||") throw new Error("Unsupported logical operator");
        const left = visit(node.left!, depth + 1);
        const right = visit(node.right!, depth + 1);
        return node.operator === "&&"
          ? (variables) => left(variables) && right(variables)
          : (variables) => left(variables) || right(variables);
      }
      case "BinaryExpression": {
        const operator = node.operator;
        if (!["===", "!==", "==", "!=", ">", ">=", "<", "<="].includes(operator!)) {
          throw new Error("Unsupported comparison operator");
        }
        const left = visit(node.left!, depth + 1);
        const right = visit(node.right!, depth + 1);
        return (variables) => {
          const a = left(variables);
          const b = right(variables);
          switch (operator) {
            case "===": return a === b;
            case "!==": return a !== b;
            case "==": return a == b;
            case "!=": return a != b;
            case ">": return (a as number) > (b as number);
            case ">=": return (a as number) >= (b as number);
            case "<": return (a as number) < (b as number);
            case "<=": return (a as number) <= (b as number);
          }
          throw new Error("Unsupported comparison operator");
        };
      }
      case "ConditionalExpression": {
        const test = visit(node.test!, depth + 1);
        const consequent = visit(node.consequent!, depth + 1);
        const alternate = visit(node.alternate!, depth + 1);
        return (variables) => test(variables) ? consequent(variables) : alternate(variables);
      }
      default:
        throw new Error(`Unsupported condition node: ${node.type}`);
    }
  };
  const evaluate = visit(program.body[0]!.expression!, 0);
  return (variables) => Boolean(evaluate(variables));
}

export function compileWorkflowConditions(edges: WorkflowEdge[]) {
  const compiled = new Map<string, Condition>();
  for (let index = 0; index < edges.length; index += 1) {
    const expression: unknown = edges[index]?.condition;
    // 兼容历史无条件边的表示。
    if (expression === undefined || expression === null || expression === "") continue;
    try {
      if (typeof expression !== "string") throw new Error("Expected a string condition");
      compiled.set(expression, compileCondition(expression));
    } catch {
      // 只给边位置，避免错误响应泄露整个工作流表达式。
      throw new Error(`Invalid workflow condition at edges[${index}]`);
    }
  }
  return compiled;
}
