/**
 * 工作流ID生成器 - 保证全局唯一性
 *
 * 设计原则：
 * 1. 节点ID：类型前缀 + 时间戳 + 计数器
 * 2. Handle ID：节点ID + 方向 + 时间戳 + 计数器
 * 3. 边ID：源节点ID + 目标节点ID + 时间戳 + 计数器
 * 4. 防冲突：检查现有ID + 重试机制
 */

// 全局计数器，确保同一时刻生成的ID也不会重复
let globalCounter = 0;

// 获取高精度时间戳（微秒）
function getTimestamp(): string {
  return Date.now().toString(36) + (globalCounter++).toString(36);
}

// 生成短随机字符串作为补充
function getRandomSuffix(): string {
  return Math.random().toString(36).substring(2, 5);
}

// ID唯一性检查接口
export interface IdValidator {
  isNodeIdTaken: (id: string) => boolean;
  isEdgeIdTaken: (id: string) => boolean;
  isHandleIdTaken: (nodeId: string, handleId: string) => boolean;
}

export class WorkflowIdGenerator {
  public validator: IdValidator;

  constructor(validator: IdValidator) {
    this.validator = validator;
  }

  /**
   * 生成节点ID
   * 格式: {nodeType}-{timestamp}-{random}
   */
  generateNodeId(nodeType: string, maxRetries = 10): string {
    const baseType = nodeType.toLowerCase();

    for (let i = 0; i < maxRetries; i++) {
      const timestamp = getTimestamp();
      const random = getRandomSuffix();
      const id = `${baseType}-${timestamp}-${random}`;

      if (!this.validator.isNodeIdTaken(id)) {
        return id;
      }
    }

    // 如果重试次数用完，使用更强的随机性
    const fallbackId = `${baseType}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    return fallbackId;
  }

  /**
   * 生成Handle ID
   * 格式: {nodeId}-{direction}-{timestamp}-{random}
   */
  generateHandleId(
    nodeId: string,
    direction: "in" | "out",
    maxRetries = 10,
  ): string {
    for (let i = 0; i < maxRetries; i++) {
      const timestamp = getTimestamp();
      const random = getRandomSuffix();
      const id = `${nodeId}-${direction}-${timestamp}-${random}`;

      if (!this.validator.isHandleIdTaken(nodeId, id)) {
        return id;
      }
    }

    // 回退方案
    const fallbackId = `${nodeId}-${direction}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    return fallbackId;
  }

  /**
   * 生成边ID
   * 格式: edge-{sourceId}-{targetId}-{timestamp}-{random}
   * 这样确保即使同样的源目标节点，多条边也有不同ID
   */
  generateEdgeId(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string,
    maxRetries = 10,
  ): string {
    for (let i = 0; i < maxRetries; i++) {
      const timestamp = getTimestamp();
      const random = getRandomSuffix();

      // 包含 handle 信息使 ID 更具描述性（存在即加入，取末段以避免过长）
      const sourceHandleSuffix = sourceHandle
        ? `-${sourceHandle.split("-").pop()}`
        : "";
      const targetHandleSuffix = targetHandle
        ? `-${targetHandle.split("-").pop()}`
        : "";

      const id = `edge-${sourceId}-${targetId}${sourceHandleSuffix}${targetHandleSuffix}-${timestamp}-${random}`;

      if (!this.validator.isEdgeIdTaken(id)) {
        return id;
      }
    }

    // 回退方案
    const fallbackId = `edge-${sourceId}-${targetId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    return fallbackId;
  }

  /**
   * 批量检查ID冲突
   */
  validateIds(
    ids: string[],
    type: "node" | "edge",
  ): { valid: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      if (seen.has(id)) {
        conflicts.push(id);
        continue;
      }

      if (type === "node" && this.validator.isNodeIdTaken(id)) {
        conflicts.push(id);
      } else if (type === "edge" && this.validator.isEdgeIdTaken(id)) {
        conflicts.push(id);
      }

      seen.add(id);
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
    };
  }

  /**
   * 从旧ID生成新的唯一ID（用于复制操作）
   */
  regenerateUniqueId(oldId: string, type: "node" | "edge"): string {
    // 提取原ID的前缀部分
    const parts = oldId.split("-");
    const prefix = parts[0] ?? "node";

    if (type === "node") {
      return this.generateNodeId(prefix);
    } else {
      // 无法可靠解析 oldId（source/target 可能包含连字符），直接生成新的通用边 ID
      return this.generateEdgeId("unknown", "unknown");
    }
  }
}

/**
 * 创建默认的ID生成器实例
 */
export function createIdGenerator(validator: IdValidator): WorkflowIdGenerator {
  return new WorkflowIdGenerator(validator);
}

/**
 * 简单的工具函数，用于快速生成唯一ID（不依赖validator）
 */
export const simpleIdGenerator = {
  node: (type: string) =>
    `${type.toLowerCase()}-${getTimestamp()}-${getRandomSuffix()}`,
  handle: (nodeId: string, direction: "in" | "out") =>
    `${nodeId}-${direction}-${getTimestamp()}-${getRandomSuffix()}`,
  edge: (sourceId: string, targetId: string) =>
    `edge-${sourceId}-${targetId}-${getTimestamp()}-${getRandomSuffix()}`,
};
