import { NodeType } from "tentix-server/constants";

/**
 * Variable definition with metadata
 */
export interface WorkflowVariable {
  name: string;
  description: string;
  category: "global" | "node";
  nodeType?: NodeType;
  example?: string;
}

// TODO: 后续通过后端配置获取变量信息，包括国际化信息
/**
 * Global variables available in all nodes
 */
export const GLOBAL_VARIABLES: WorkflowVariable[] = [
  {
    name: "ticketDescription",
    description: "rf.var.desc.ticketDescription",
    category: "global",
    example: "{{ ticketDescription }}",
  },
  {
    name: "ticketModule",
    description: "rf.var.desc.ticketModule",
    category: "global",
    example: "{{ ticketModule }}",
  },
  {
    name: "ticketCategory",
    description: "rf.var.desc.ticketCategory",
    category: "global",
    example: "{{ ticketCategory }}",
  },
  {
    name: "ticketTitle",
    description: "rf.var.desc.ticketTitle",
    category: "global",
    example: "{{ ticketTitle }}",
  },
  {
    name: "lastCustomerMessage",
    description: "rf.var.desc.lastCustomerMessage",
    category: "global",
    example: "{{ lastCustomerMessage }}",
  },
  {
    name: "historyMessages",
    description: "rf.var.desc.historyMessages",
    category: "global",
    example: "{{ historyMessages }}",
  },
  {
    name: "userQuery",
    description: "rf.var.desc.userQuery",
    category: "global",
    example: "{{ userQuery }}",
  },
];

/**
 * Node-specific variables
 */
export const NODE_VARIABLES: Record<NodeType, WorkflowVariable[]> = {
  [NodeType.EMOTION_DETECTOR]: [
    {
      name: "sentiment",
      description: "rf.var.desc.emotionDetector.sentiment",
      category: "node",
      nodeType: NodeType.EMOTION_DETECTOR,
      example: "{{ sentiment }}",
    },
    {
      name: "stylePrompt",
      description: "rf.var.desc.emotionDetector.stylePrompt",
      category: "node",
      nodeType: NodeType.EMOTION_DETECTOR,
      example: "{{ stylePrompt }}",
    },
    {
      name: "handoffReason",
      description: "rf.var.desc.emotionDetector.handoffReason",
      category: "node",
      nodeType: NodeType.EMOTION_DETECTOR,
      example: "{{ handoffReason }}",
    },
    {
      name: "handoffPriority",
      description: "rf.var.desc.emotionDetector.handoffPriority",
      category: "node",
      nodeType: NodeType.EMOTION_DETECTOR,
      example: "{{ handoffPriority }}",
    },
    {
      name: "handoffRequired",
      description: "rf.var.desc.emotionDetector.handoffRequired",
      category: "node",
      nodeType: NodeType.EMOTION_DETECTOR,
      example: "{{ handoffRequired }}",
    },
  ],
  [NodeType.ESCALATION_OFFER]: [
    {
      name: "proposeEscalation",
      description: "rf.var.desc.escalationOffer.proposeEscalation",
      category: "node",
      nodeType: NodeType.ESCALATION_OFFER,
      example: "{{ proposeEscalation }}",
    },
    {
      name: "escalationReason",
      description: "rf.var.desc.escalationOffer.escalationReason",
      category: "node",
      nodeType: NodeType.ESCALATION_OFFER,
      example: "{{ escalationReason }}",
    },
    {
      name: "handoffPriority",
      description: "rf.var.desc.escalationOffer.handoffPriority",
      category: "node",
      nodeType: NodeType.ESCALATION_OFFER,
      example: "{{ handoffPriority }}",
    },
  ],
  [NodeType.SMART_CHAT]: [
    {
      name: "retrievedContextString",
      description: "rf.var.desc.smartChat.retrievedContextString",
      category: "node",
      nodeType: NodeType.SMART_CHAT,
      example: "{{ retrievedContextString }}",
    },
    {
      name: "retrievedContextCount",
      description: "rf.var.desc.smartChat.retrievedContextCount",
      category: "node",
      nodeType: NodeType.SMART_CHAT,
      example: "{{ retrievedContextCount }}",
    },
    {
      name: "hasRetrievedContext",
      description: "rf.var.desc.smartChat.hasRetrievedContext",
      category: "node",
      nodeType: NodeType.SMART_CHAT,
      example: "{{ hasRetrievedContext }}",
    },
  ],
  // Other node types don't have specific variables
  [NodeType.HANDOFF]: [],
  [NodeType.VARIABLE_SETTER]: [],
  [NodeType.START]: [],
  [NodeType.END]: [],
};

/**
 * Get available variables for a specific node
 *
 * @param currentNodeId - Current node ID (optional)
 * @param nodes - All nodes in the workflow
 * @param edges - All edges in the workflow
 *
 * Behavior:
 * - If `currentNodeId` is NOT provided:
 *     Returns only global variables (safe for all contexts)
 *
 * - If `currentNodeId` is provided:
 *     Returns global variables + variables from upstream nodes
 *     (respects execution order, excludes current node)
 */
export function getAvailableVariables(
  currentNodeId: string | undefined,
  nodes: Array<{ id: string; type: NodeType }>,
  edges: Array<{ source: string; target: string }>,
): WorkflowVariable[] {
  // Always include global variables
  const variables: WorkflowVariable[] = [...GLOBAL_VARIABLES];

  if (!currentNodeId) {
    // No nodeId provided: only return global variables
    // Cannot determine which node-specific variables are available
    return variables;
  }

  // NodeId provided: include variables from upstream nodes
  // (nodes that execute before the current node)
  const upstreamNodes = findUpstreamNodes(currentNodeId, nodes, edges);

  // Add variables from upstream nodes
  upstreamNodes.forEach((node) => {
    const nodeVars = NODE_VARIABLES[node.type] || [];
    variables.push(...nodeVars);
  });

  return variables;
}

/**
 * Find all nodes that come before the current node in the workflow
 * Uses BFS to traverse backwards from current node
 */
function findUpstreamNodes(
  currentNodeId: string,
  nodes: Array<{ id: string; type: NodeType }>,
  edges: Array<{ source: string; target: string }>,
): Array<{ id: string; type: NodeType }> {
  const upstream = new Set<string>();
  const queue: string[] = [];

  // Find all edges that target the current node
  const incomingEdges = edges.filter((e) => e.target === currentNodeId);
  incomingEdges.forEach((e) => {
    if (!upstream.has(e.source)) {
      upstream.add(e.source);
      queue.push(e.source);
    }
  });

  // BFS to find all upstream nodes
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const incomingToThis = edges.filter((e) => e.target === nodeId);

    incomingToThis.forEach((e) => {
      if (!upstream.has(e.source)) {
        upstream.add(e.source);
        queue.push(e.source);
      }
    });
  }

  // Map node IDs to node objects
  return nodes.filter((n) => upstream.has(n.id));
}

/**
 * Get all variables (global + all node variables) for documentation purposes
 */
export function getAllVariables(): WorkflowVariable[] {
  const allVars = [...GLOBAL_VARIABLES];

  Object.values(NODE_VARIABLES).forEach((nodeVars) => {
    allVars.push(...nodeVars);
  });

  return allVars;
}