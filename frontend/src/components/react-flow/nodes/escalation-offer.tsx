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
  type EscalationOfferConfig,
  type LLMConfig,
} from "tentix-server/constants";
import {
  Input,
  Textarea,
  Label,
  Separator,
  ScrollArea,
  ScrollBar,
} from "tentix-ui";

type EscalationOfferNodeData = EscalationOfferConfig["config"] & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

const EscalationOffer: React.FC<NodeProps<Node<EscalationOfferNodeData>>> = ({
  id,
  data,
}) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const safeData = useMemo(
    () => data || ({} as EscalationOfferNodeData),
    [data],
  );

  const patchConfig = useCallback(
    (patch: Partial<EscalationOfferConfig["config"]>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.ESCALATION_OFFER) return prev;
        const typedPrev = prev as EscalationOfferConfig;
        const prevConfig: EscalationOfferConfig["config"] =
          typedPrev.config ?? ({} as EscalationOfferConfig["config"]);
        const nextConfig: EscalationOfferConfig["config"] = {
          ...prevConfig,
          ...patch,
        };
        const next: EscalationOfferConfig = {
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
        if (prev.type !== NodeType.ESCALATION_OFFER) return prev;
        const typedPrev = prev as EscalationOfferConfig;
        const prevConfig: EscalationOfferConfig["config"] =
          typedPrev.config ?? ({} as EscalationOfferConfig["config"]);
        const next: EscalationOfferConfig["config"] = { ...prevConfig };

        if (path === "llm") {
          const raw: Partial<LLMConfig> = {
            ...(prevConfig.llm ?? {}),
            ...(patch as Partial<LLMConfig>),
          };
          const empty = !raw.model && !raw.baseURL && !raw.apiKey;
          next.llm = empty ? undefined : (raw as LLMConfig);
        }

        const result: EscalationOfferConfig = { ...typedPrev, config: next };
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
      <BaseNode className="w-[300px] h-[420px] bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg overflow-hidden flex flex-col">
        <BaseNodeHeader className="bg-zinc-300 text-white relative flex-shrink-0">
          <BaseNodeHeaderTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              升级询问
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
                <div className="grid gap-1">
                  <Label className="text-xs">升级询问消息模板</Label>
                  <Textarea
                    className="min-h-12 nodrag nowheel"
                    value={safeData.escalationOfferMessageTemplate || ""}
                    onChange={(e) =>
                      patchConfig({
                        escalationOfferMessageTemplate: e.target.value,
                      })
                    }
                  />
                </div>

                <Separator className="my-1" />

                <div className="space-y-2">
                  <div className="font-medium text-foreground">对话设置</div>
                  <div className="grid gap-1">
                    <Label className="text-xs">System Prompt</Label>
                    <Textarea
                      className="min-h-12 nodrag nowheel"
                      value={safeData.systemPrompt || ""}
                      onChange={(e) =>
                        patchConfig({ systemPrompt: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">User Prompt</Label>
                    <Textarea
                      className="min-h-12 nodrag nowheel"
                      value={safeData.userPrompt || ""}
                      onChange={(e) =>
                        patchConfig({ userPrompt: e.target.value })
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

      {(data.handles ?? [])
        .filter((h: HandleConfig) => h.type === "target")
        .map((h: HandleConfig) => (
          <WorkflowHandle key={h.id} handle={h} />
        ))}

      {(data.handles ?? [])
        .filter((h: HandleConfig) => h.type === "source")
        .map((h: HandleConfig, index) => (
          <WorkflowHandle key={h.id} handle={h} index={index} />
        ))}
    </div>
  );
};

export default EscalationOffer;
