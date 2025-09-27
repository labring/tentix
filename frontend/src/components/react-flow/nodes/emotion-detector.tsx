import React, { useCallback, useMemo, useState, useEffect } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { X, Plus, Trash2 } from "lucide-react";

import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@comp/react-flow/ui/base-node";
import { useWorkflowStore } from "@store/workflow";

import { WorkflowHandle } from "@comp/react-flow/ui/workflow-handle";
import { ConditionHandle } from "@comp/react-flow/ui/condition-handle";
import {
  NodeType,
  type HandleConfig,
  type EmotionDetectionConfig,
  type LLMConfig,
} from "tentix-server/constants";
import {
  Input,
  Label,
  Separator,
  ScrollArea,
  ScrollBar,
  Button,
} from "tentix-ui";
import { WorkflowTextarea } from "@comp/react-flow/components/workflow-textarea";
import { cn } from "@lib/utils";

type EmotionDetectorNodeData = EmotionDetectionConfig["config"] & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

const EmotionDetector: React.FC<NodeProps<Node<EmotionDetectorNodeData>>> = ({
  id,
  data,
}) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const addHandleToNode = useWorkflowStore((s) => s.addHandleToNode);
  const removeHandleFromNode = useWorkflowStore((s) => s.removeHandleFromNode);
  const updateHandle = useWorkflowStore((s) => s.updateHandle);

  const safeData = useMemo(
    () => data || ({} as EmotionDetectorNodeData),
    [data],
  );

  const patchConfig = useCallback(
    (patch: Partial<EmotionDetectionConfig["config"]>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.EMOTION_DETECTOR) return prev;
        const typedPrev = prev as EmotionDetectionConfig;
        const prevConfig: EmotionDetectionConfig["config"] =
          typedPrev.config ?? ({} as EmotionDetectionConfig["config"]);
        const nextConfig: EmotionDetectionConfig["config"] = {
          ...prevConfig,
          ...patch,
        };
        const next: EmotionDetectionConfig = {
          ...typedPrev,
          config: nextConfig,
        };
        return next;
      });
    },
    [id, updateNode],
  );

  type PatchPath = "llm";
  type PatchValue<P extends PatchPath> = P extends "llm"
    ? Partial<LLMConfig>
    : never;

  const patchNested = useCallback(
    <P extends PatchPath>(path: P, patch: PatchValue<P>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.EMOTION_DETECTOR) return prev;
        const typedPrev = prev as EmotionDetectionConfig;
        const prevConfig: EmotionDetectionConfig["config"] =
          typedPrev.config ?? ({} as EmotionDetectionConfig["config"]);
        const next: EmotionDetectionConfig["config"] = { ...prevConfig };

        if (path === "llm") {
          const raw: Partial<LLMConfig> = {
            ...(prevConfig.llm ?? {}),
            ...(patch as Partial<LLMConfig>),
          };
          const empty = !raw.model && !raw.baseURL && !raw.apiKey;
          next.llm = empty ? undefined : (raw as LLMConfig);
        }

        const result: EmotionDetectionConfig = { ...typedPrev, config: next };
        return result;
      });
    },
    [id, updateNode],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeNode(id);
    },
    [id, removeNode],
  );

  // 获取条件相关的 handles
  const conditionHandles = useMemo(() => {
    return (data.handles ?? []).filter(
      (h: HandleConfig) => h.condition !== undefined,
    );
  }, [data.handles]);

  // 同步条件状态（当 handles 变化时同步）
  useEffect(() => {
    const existingConditions = conditionHandles.map((h) => h.condition || "");
    setConditions(existingConditions);
  }, [conditionHandles]);

  // 条件管理
  const [conditions, setConditions] = useState<string[]>(() => {
    return conditionHandles.map((h) => h.condition || "");
  });

  // 添加条件
  const addCondition = useCallback(() => {
    const newCondition = "";
    setConditions((prev) => [...prev, newCondition]);
    // 交由 store 生成唯一 handle id 并追加到节点
    addHandleToNode(id, {
      position: "right",
      type: "source",
      condition: newCondition,
    } as HandleConfig);
  }, [id, addHandleToNode]);

  // 删除条件
  const removeCondition = useCallback(
    (index: number) => {
      setConditions((prev) => prev.filter((_, i) => i !== index));
      const targetHandleId = conditionHandles[index]?.id;
      if (!targetHandleId) return;
      // 使用 store API 按 id 删除 handle，并级联移除相关边
      removeHandleFromNode(id, targetHandleId);
    },
    [id, conditionHandles, removeHandleFromNode],
  );

  // 更新条件
  const updateCondition = useCallback(
    (index: number, value: string) => {
      setConditions((prev) =>
        prev.map((cond, i) => (i === index ? value : cond)),
      );
      const targetHandleId = conditionHandles[index]?.id;
      if (!targetHandleId) return;
      // 使用 store API 更新指定 handle 的 condition
      updateHandle(id, targetHandleId, (prev) => ({
        ...prev,
        condition: value,
      }));
    },
    [id, conditionHandles, updateHandle],
  );

  // 统一通过 CSS 变量传递固定高度，避免硬编码在多个位置
  const BASE_NODE_HEIGHT = 420;
  const CONDITION_ROW_HEIGHT = 40; // 单行条件的高度

  const getNormalSourceTopPx = useCallback((i: number) => {
    // 复用旧的百分比方案，但换算为像素并固定锚定在 BaseNode 高度，避免外部容器高度变化导致位移
    const ratio = i > 0 ? 0.4 + i * 0.3 : 0.5; // 0:50%, 1:70%, 2:100%
    return BASE_NODE_HEIGHT * ratio;
  }, []);

  return (
    <div className="relative group">
      <BaseNode
        className={cn(
          "bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg overflow-hidden flex flex-col",
          "w-[300px]",
        )}
        style={{ height: `${BASE_NODE_HEIGHT}px` }}
      >
        <BaseNodeHeader className="bg-zinc-300 text-white relative flex-shrink-0">
          <BaseNodeHeaderTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
              情绪检测
            </div>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-400 rounded nodrag transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </BaseNodeHeaderTitle>
        </BaseNodeHeader>
        <BaseNodeContent className="p-0 bg-white flex-1 min-h-0">
          <ScrollArea className="h-full nowheel">
            <div className="p-3">
              <div className="text-xs text-muted-foreground mb-2">
                {safeData.description}
              </div>

              <div className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="font-medium text-foreground">检测配置</div>
                  <div className="grid gap-1">
                    <Label className="text-xs">System Prompt</Label>
                    <WorkflowTextarea
                      className="min-h-12"
                      value={safeData.systemPrompt || ""}
                      onChange={(value) =>
                        patchConfig({ systemPrompt: value })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">User Prompt</Label>
                    <WorkflowTextarea
                      className="min-h-12"
                      value={safeData.userPrompt || ""}
                      onChange={(value) =>
                        patchConfig({ userPrompt: value })
                      }
                    />
                  </div>
                </div>

                <Separator className="my-1" />

                <div className="space-y-2">
                  <div className="font-medium text-foreground">LLM 设置</div>
                  <div className="grid gap-1">
                    <Label className="text-xs">LLM - Model</Label>
                    <Input
                      className="nodrag"
                      value={safeData.llm?.model || ""}
                      onChange={(e) =>
                        patchNested("llm", { model: e.target.value.trim() })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">LLM - Base URL</Label>
                    <Input
                      className="nodrag"
                      value={safeData.llm?.baseURL || ""}
                      onChange={(e) =>
                        patchNested("llm", {
                          baseURL: e.target.value.trim() || undefined,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">LLM - API Key</Label>
                    <Input
                      className="nodrag"
                      type="password"
                      value={safeData.llm?.apiKey || ""}
                      onChange={(e) =>
                        patchNested("llm", {
                          apiKey: e.target.value.trim() || undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </BaseNodeContent>
      </BaseNode>

      {/* 条件管理区域 */}
      <div className="mt-4 w-[300px] bg-muted rounded-md border border-border p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-foreground">输出条件</div>
          <Button
            size="sm"
            variant="outline"
            onClick={addCondition}
            className="h-7 px-2 text-xs nodrag"
          >
            <Plus className="w-3 h-3 mr-1" />
            添加条件
          </Button>
        </div>

        {/* 条件列表 */}
          <div className="space-y-2">
          {conditionHandles.map((handle, index) => (
            <div
              key={handle.id}
                className="flex items-center gap-2 relative rounded-md bg-card/60 hover:bg-card/80 transition-colors border border-border/60 px-2"
              style={{ height: `${CONDITION_ROW_HEIGHT}px` }}
            >
              <Input
                placeholder="输入条件表达式"
                value={conditions[index] || handle.condition || ""}
                onChange={(e) => updateCondition(index, e.target.value)}
                  className="flex-1 h-8 text-xs nodrag"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeCondition(index)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 nodrag"
              >
                <Trash2 className="w-3 h-3" />
              </Button>

              {/* 条件对应的连接点 */}
              <ConditionHandle handle={handle} />
            </div>
          ))}
        </div>

        {conditionHandles.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            暂无输出条件，点击「添加条件」创建
          </div>
        )}
      </div>

      {/* source 多，用分布函数；target 单，居中固定像素即可 */}
      {/* 普通的 target handles */}
      {(data.handles ?? [])
        .filter((h: HandleConfig) => h.type === "target")
        .map((h: HandleConfig) => (
          <WorkflowHandle
            key={h.id}
            handle={h}
            position={{ y: BASE_NODE_HEIGHT / 2 }}
          />
        ))}

      {/* 普通的 source handles（非条件） */}
      {(data.handles ?? [])
        .filter(
          (h: HandleConfig) => h.type === "source" && h.condition === undefined,
        )
        .map((h: HandleConfig, index) => (
          <WorkflowHandle
            key={h.id}
            handle={h}
            index={index}
            position={{ y: getNormalSourceTopPx(index) }}
          />
        ))}
    </div>
  );
};

export default EmotionDetector;
