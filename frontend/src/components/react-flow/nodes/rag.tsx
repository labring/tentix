import React, { useCallback, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@comp/react-flow/ui/base-node";
import { useWorkflowStore } from "@store/workflow";

import { WorkflowHandle } from "@comp/react-flow/ui/workflow-handle";
import {
  NodeType,
  type HandleConfig,
  type RagConfig,
  type LLMConfig,
} from "tentix-server/constants";
import {
  Input,
  Switch,
  Label,
  Separator,
  ScrollArea,
  ScrollBar,
} from "tentix-ui";
import { WorkflowTextarea } from "@comp/react-flow/components/workflow-textarea";

type RagNodeData = RagConfig["config"] & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

const Rag: React.FC<NodeProps<Node<RagNodeData>>> = ({ id, data }) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const safeData = useMemo(() => data || ({} as RagNodeData), [data]);

  const patchConfig = useCallback(
    (patch: Partial<RagConfig["config"]>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.RAG) return prev;
        const ragPrev = prev as RagConfig;
        const prevConfig: RagConfig["config"] =
          ragPrev.config ?? ({} as RagConfig["config"]);
        const nextConfig: RagConfig["config"] = {
          ...prevConfig,
          ...patch,
        };
        const next: RagConfig = { ...ragPrev, config: nextConfig };
        return next;
      });
    },
    [id, updateNode],
  );

  type PatchPath =
    | "intentAnalysisConfig"
    | "intentAnalysisConfig.intentAnalysisLLM";
  type IntentAnalysisCfg = NonNullable<
    RagConfig["config"]["intentAnalysisConfig"]
  >;
  type PatchValue<P extends PatchPath> = P extends "intentAnalysisConfig"
    ? Partial<IntentAnalysisCfg>
    : P extends "intentAnalysisConfig.intentAnalysisLLM"
      ? Partial<LLMConfig>
      : never;

  const patchNested = useCallback(
    <P extends PatchPath>(path: P, patch: PatchValue<P>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.RAG) return prev;
        const ragPrev = prev as RagConfig;
        const prevConfig: RagConfig["config"] =
          ragPrev.config ?? ({} as RagConfig["config"]);
        const next: RagConfig["config"] = { ...prevConfig };

        if (path === "intentAnalysisConfig") {
          next.intentAnalysisConfig = {
            ...(prevConfig.intentAnalysisConfig ?? ({} as IntentAnalysisCfg)),
            ...(patch as Partial<IntentAnalysisCfg>),
          };
        } else if (path === "intentAnalysisConfig.intentAnalysisLLM") {
          const raw: Partial<LLMConfig> = {
            ...((prevConfig.intentAnalysisConfig ?? {}).intentAnalysisLLM ??
              {}),
            ...(patch as Partial<LLMConfig>),
          };
          const empty = !raw.model && !raw.baseURL && !raw.apiKey;
          next.intentAnalysisConfig = {
            ...(prevConfig.intentAnalysisConfig ?? ({} as IntentAnalysisCfg)),
            intentAnalysisLLM: empty ? undefined : (raw as LLMConfig),
          };
        }

        const result: RagConfig = { ...ragPrev, config: next };
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

  return (
    <div className="relative group">
      <BaseNode className="w-[300px] h-[760px] bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg overflow-hidden flex flex-col pb-4">
        <BaseNodeHeader className="bg-zinc-300 text-white relative flex-shrink-0">
          <BaseNodeHeaderTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              检索增强生成
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
                <div className="flex items-center justify-between">
                  <div className="font-medium text-foreground">启用意图分析</div>
                  <Switch
                    className="nodrag"
                    checked={!!safeData.enableIntentAnalysis}
                    onCheckedChange={(v) =>
                      patchConfig({ enableIntentAnalysis: v })
                    }
                  />
                </div>

                {safeData.enableIntentAnalysis ? (
                  <div className="rounded-md border p-2 space-y-3">
                    <div className="space-y-2">
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          意图分析 System Prompt
                        </Label>
                        <WorkflowTextarea
                          className="min-h-12"
                          value={
                            safeData.intentAnalysisConfig
                              ?.intentAnalysisSystemPrompt || ""
                          }
                          onChange={(value) =>
                            patchNested("intentAnalysisConfig", {
                              intentAnalysisSystemPrompt: value,
                            })
                          }
                          nodeId={id}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">意图分析 User Prompt</Label>
                        <WorkflowTextarea
                          className="min-h-12"
                          value={
                            safeData.intentAnalysisConfig
                              ?.intentAnalysisUserPrompt || ""
                          }
                          onChange={(value) =>
                            patchNested("intentAnalysisConfig", {
                              intentAnalysisUserPrompt: value,
                            })
                          }
                          nodeId={id}
                        />
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">意图分析 LLM - Model</Label>
                        <Input
                          className="nodrag"
                          value={
                            safeData.intentAnalysisConfig?.intentAnalysisLLM
                              ?.model || ""
                          }
                          onChange={(e) =>
                            patchNested("intentAnalysisConfig.intentAnalysisLLM", {
                              model: e.target.value.trim(),
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          意图分析 LLM - Base URL
                        </Label>
                        <Input
                          className="nodrag"
                          value={
                            safeData.intentAnalysisConfig?.intentAnalysisLLM
                              ?.baseURL || ""
                          }
                          onChange={(e) =>
                            patchNested("intentAnalysisConfig.intentAnalysisLLM", {
                              baseURL: e.target.value.trim() || undefined,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          意图分析 LLM - API Key
                        </Label>
                        <Input
                          type="password"
                          className="nodrag"
                          value={
                            safeData.intentAnalysisConfig?.intentAnalysisLLM
                              ?.apiKey || ""
                          }
                          onChange={(e) =>
                            patchNested("intentAnalysisConfig.intentAnalysisLLM", {
                              apiKey: e.target.value.trim() || undefined,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <Separator className="my-1" />

                <div className="space-y-2">
                  <div className="font-medium text-foreground">生成检索语</div>
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      生成检索语 System Prompt
                    </Label>
                    <WorkflowTextarea
                      className="min-h-12"
                      value={safeData.generateSearchQueriesSystemPrompt || ""}
                      onChange={(value) =>
                        patchConfig({
                          generateSearchQueriesSystemPrompt: value,
                        })
                      }
                      nodeId={id}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">生成检索语 User Prompt</Label>
                    <WorkflowTextarea
                      className="min-h-12"
                      value={safeData.generateSearchQueriesUserPrompt || ""}
                      onChange={(value) =>
                        patchConfig({
                          generateSearchQueriesUserPrompt: value,
                        })
                      }
                      nodeId={id}
                    />
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-xs">生成检索语 LLM - Model</Label>
                    <Input
                      className="nodrag"
                      value={safeData.generateSearchQueriesLLM?.model || ""}
                      onChange={(e) =>
                        patchConfig({
                          generateSearchQueriesLLM: {
                            ...(safeData.generateSearchQueriesLLM ?? {}),
                            model: e.target.value.trim(),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      生成检索语 LLM - Base URL
                    </Label>
                    <Input
                      className="nodrag"
                      value={safeData.generateSearchQueriesLLM?.baseURL || ""}
                      onChange={(e) => {
                        const val = e.target.value.trim() || undefined;
                        const raw: Partial<LLMConfig> = {
                          ...(safeData.generateSearchQueriesLLM ?? {}),
                          baseURL: val,
                        };
                        const empty = !raw.model && !raw.baseURL && !raw.apiKey;
                        patchConfig({
                          generateSearchQueriesLLM: empty
                            ? undefined
                            : (raw as LLMConfig),
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">生成检索语 LLM - API Key</Label>
                    <Input
                      type="password"
                      className="nodrag"
                      value={safeData.generateSearchQueriesLLM?.apiKey || ""}
                      onChange={(e) => {
                        const val = e.target.value.trim() || undefined;
                        const raw: Partial<LLMConfig> = {
                          ...(safeData.generateSearchQueriesLLM ?? {}),
                          apiKey: val,
                        };
                        const empty = !raw.model && !raw.baseURL && !raw.apiKey;
                        patchConfig({
                          generateSearchQueriesLLM: empty
                            ? undefined
                            : (raw as LLMConfig),
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </BaseNodeContent>
      </BaseNode>

      {/* 输入 Handles */}
      {(data.handles ?? [])
        .filter((h: HandleConfig) => h.type === "target")
        .map((h: HandleConfig) => (
          <WorkflowHandle key={h.id} handle={h} />
        ))}

      {/* 输出 Handles */}
      {(data.handles ?? [])
        .filter((h: HandleConfig) => h.type === "source")
        .map((h: HandleConfig, index) => (
          <WorkflowHandle key={h.id} handle={h} index={index} />
        ))}
    </div>
  );
};

export default Rag;

