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
  type SmartChatConfig,
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
type SmartChatNodeData = SmartChatConfig["config"] & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

const SmartChat: React.FC<NodeProps<Node<SmartChatNodeData>>> = ({
  id,
  data,
}) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const safeData = useMemo(() => data || ({} as SmartChatNodeData), [data]);

  const patchConfig = useCallback(
    (patch: Partial<SmartChatConfig["config"]>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.SMART_CHAT) return prev;
        const smartPrev = prev as SmartChatConfig;
        const prevConfig: SmartChatConfig["config"] =
          smartPrev.config ?? ({} as SmartChatConfig["config"]);
        const nextConfig: SmartChatConfig["config"] = {
          ...prevConfig,
          ...patch,
        };
        const next: SmartChatConfig = { ...smartPrev, config: nextConfig };
        return next;
      });
    },
    [id, updateNode],
  );

  type PatchPath =
    | "ragConfig"
    | "ragConfig.intentAnalysisLLM"
    | "ragConfig.generateSearchQueriesLLM"
    | "llm"
    | "visionConfig";
  type VisionCfg = NonNullable<SmartChatConfig["config"]["visionConfig"]>;
  type RagCfg = NonNullable<SmartChatConfig["config"]["ragConfig"]>;
  type PatchValue<P extends PatchPath> = P extends "ragConfig"
    ? Partial<RagCfg>
    : P extends "ragConfig.intentAnalysisLLM"
      ? Partial<LLMConfig>
      : P extends "ragConfig.generateSearchQueriesLLM"
        ? Partial<LLMConfig>
        : P extends "llm"
          ? Partial<LLMConfig>
          : P extends "visionConfig"
            ? Partial<VisionCfg>
            : never;

  const patchNested = useCallback(
    <P extends PatchPath>(path: P, patch: PatchValue<P>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.SMART_CHAT) return prev;
        const smartPrev = prev as SmartChatConfig;
        const prevConfig: SmartChatConfig["config"] =
          smartPrev.config ?? ({} as SmartChatConfig["config"]);
        const next: SmartChatConfig["config"] = { ...prevConfig };

        if (path === "llm") {
          const nextLLM: Partial<LLMConfig> = {
            ...(prevConfig.llm ?? {}),
            ...(patch as Partial<LLMConfig>),
          };
          const empty = !nextLLM.model && !nextLLM.baseURL && !nextLLM.apiKey;
          next.llm = empty ? undefined : (nextLLM as LLMConfig);
        } else if (path === "visionConfig") {
          next.visionConfig = {
            ...(prevConfig.visionConfig ?? ({} as VisionCfg)),
            ...(patch as Partial<VisionCfg>),
          };
        } else if (path === "ragConfig") {
          next.ragConfig = {
            ...(prevConfig.ragConfig ?? ({} as RagCfg)),
            ...(patch as Partial<RagCfg>),
          };
        } else if (path === "ragConfig.intentAnalysisLLM") {
          const raw: Partial<LLMConfig> = {
            ...((prevConfig.ragConfig ?? {}).intentAnalysisLLM ?? {}),
            ...(patch as Partial<LLMConfig>),
          };
          const empty = !raw.model && !raw.baseURL && !raw.apiKey;
          next.ragConfig = {
            ...(prevConfig.ragConfig ?? ({} as RagCfg)),
            intentAnalysisLLM: empty ? undefined : (raw as LLMConfig),
          };
        } else if (path === "ragConfig.generateSearchQueriesLLM") {
          const raw: Partial<LLMConfig> = {
            ...((prevConfig.ragConfig ?? {}).generateSearchQueriesLLM ?? {}),
            ...(patch as Partial<LLMConfig>),
          };
          const empty = !raw.model && !raw.baseURL && !raw.apiKey;
          next.ragConfig = {
            ...(prevConfig.ragConfig ?? ({} as RagCfg)),
            generateSearchQueriesLLM: empty ? undefined : (raw as LLMConfig),
          };
        }

        const result: SmartChatConfig = { ...smartPrev, config: next };
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
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              智能聊天
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
                  <div className="font-medium text-foreground">启用 RAG</div>
                  <Switch
                    className="nodrag"
                    checked={!!safeData.enableRAG}
                    onCheckedChange={(v) => patchConfig({ enableRAG: v })}
                  />
                </div>

                {safeData.enableRAG ? (
                  <div className="rounded-md border p-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-foreground">启用意图分析</div>
                      <Switch
                        className="nodrag"
                        checked={!!safeData.ragConfig?.enableIntentAnalysis}
                        onCheckedChange={(v) =>
                          patchNested("ragConfig", { enableIntentAnalysis: v })
                        }
                      />
                    </div>

                    {safeData.ragConfig?.enableIntentAnalysis ? (
                      <div className="space-y-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">
                            意图分析 System Prompt
                          </Label>
                          <WorkflowTextarea
                            className="min-h-12"
                            value={
                              safeData.ragConfig?.intentAnalysisSystemPrompt ||
                              ""
                            }
                            onChange={(value) =>
                              patchNested("ragConfig", {
                                intentAnalysisSystemPrompt: value,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">
                            意图分析 User Prompt
                          </Label>
                          <WorkflowTextarea
                            className="min-h-12"
                            value={
                              safeData.ragConfig?.intentAnalysisUserPrompt || ""
                            }
                            onChange={(value) =>
                              patchNested("ragConfig", {
                                intentAnalysisUserPrompt: value,
                              })
                            }
                          />
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-xs">
                            意图分析 LLM - Model
                          </Label>
                          <Input
                            className="nodrag"
                            value={
                              safeData.ragConfig?.intentAnalysisLLM?.model || ""
                            }
                            onChange={(e) =>
                              patchNested("ragConfig.intentAnalysisLLM", {
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
                              safeData.ragConfig?.intentAnalysisLLM?.baseURL ||
                              ""
                            }
                            onChange={(e) =>
                              patchNested("ragConfig.intentAnalysisLLM", {
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
                              safeData.ragConfig?.intentAnalysisLLM?.apiKey ||
                              ""
                            }
                            onChange={(e) =>
                              patchNested("ragConfig.intentAnalysisLLM", {
                                apiKey: e.target.value.trim() || undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    <Separator className="my-2" />

                    <div className="space-y-2">
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          生成检索语 System Prompt
                        </Label>
                        <WorkflowTextarea
                          className="min-h-12"
                          value={
                            safeData.ragConfig
                              ?.generateSearchQueriesSystemPrompt || ""
                          }
                          onChange={(value) =>
                            patchNested("ragConfig", {
                              generateSearchQueriesSystemPrompt: value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          生成检索语 User Prompt
                        </Label>
                        <WorkflowTextarea
                          className="min-h-12"
                          value={
                            safeData.ragConfig
                              ?.generateSearchQueriesUserPrompt || ""
                          }
                          onChange={(value) =>
                            patchNested("ragConfig", {
                              generateSearchQueriesUserPrompt: value,
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">
                          生成检索语 LLM - Model
                        </Label>
                        <Input
                          className="nodrag"
                          value={
                            safeData.ragConfig?.generateSearchQueriesLLM
                              ?.model || ""
                          }
                          onChange={(e) =>
                            patchNested("ragConfig.generateSearchQueriesLLM", {
                              model: e.target.value.trim(),
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
                          value={
                            safeData.ragConfig?.generateSearchQueriesLLM
                              ?.baseURL || ""
                          }
                          onChange={(e) =>
                            patchNested("ragConfig.generateSearchQueriesLLM", {
                              baseURL: e.target.value.trim() || undefined,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          生成检索语 LLM - API Key
                        </Label>
                        <Input
                          type="password"
                          className="nodrag"
                          value={
                            safeData.ragConfig?.generateSearchQueriesLLM
                              ?.apiKey || ""
                          }
                          onChange={(e) =>
                            patchNested("ragConfig.generateSearchQueriesLLM", {
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
                  <div className="font-medium text-foreground">对话设置</div>
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
                      type="password"
                      className="nodrag"
                      value={safeData.llm?.apiKey || ""}
                      onChange={(e) =>
                        patchNested("llm", {
                          apiKey: e.target.value.trim() || undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <Separator className="my-1" />

                <div className="flex items-center justify-between">
                  <div className="font-medium text-foreground">启用视觉</div>
                  <Switch
                    className="nodrag"
                    checked={!!safeData.enableVision}
                    onCheckedChange={(v) => patchConfig({ enableVision: v })}
                  />
                </div>
                {safeData.enableVision ? (
                  <div className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-foreground">包含工单描述图片</div>
                      <Switch
                        className="nodrag"
                        checked={
                          !!safeData.visionConfig
                            ?.includeTicketDescriptionImages
                        }
                        onCheckedChange={(v) =>
                          patchNested("visionConfig", {
                            includeTicketDescriptionImages: v,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
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

export default SmartChat;
