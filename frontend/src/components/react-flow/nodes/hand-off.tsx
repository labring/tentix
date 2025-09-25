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
  type HandoffConfig,
  type HandoffNotifyChannel,
} from "tentix-server/constants";
import { Label, Textarea, Separator, ScrollArea, ScrollBar } from "tentix-ui";
import { CommonCombobox } from "@comp/common/combobox";

type HandoffNodeData = HandoffConfig["config"] & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
};

type NotifyOption = {
  id: HandoffNotifyChannel;
  label: string;
  description?: string;
};

const NOTIFY_OPTIONS: NotifyOption[] = [
  { id: "feishu", label: "飞书", description: "通过飞书发送通知" },
  { id: "email", label: "邮箱", description: "通过邮件发送通知" },
  { id: "wechat", label: "企业微信", description: "通过企业微信发送通知" },
  { id: "sms", label: "短信", description: "通过短信发送通知" },
];

const HandOff: React.FC<NodeProps<Node<HandoffNodeData>>> = ({ id, data }) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const safeData = useMemo(() => data || ({} as HandoffNodeData), [data]);

  const patchConfig = useCallback(
    (patch: Partial<HandoffConfig["config"]>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.HANDOFF) return prev;
        const typedPrev = prev as HandoffConfig;
        const prevConfig: HandoffConfig["config"] =
          typedPrev.config ?? ({} as HandoffConfig["config"]);
        const nextConfig: HandoffConfig["config"] = {
          ...prevConfig,
          ...patch,
        };
        const next: HandoffConfig = { ...typedPrev, config: nextConfig };
        return next;
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
      <BaseNode className="w-[300px] h-[270px] bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg overflow-hidden flex flex-col">
        <BaseNodeHeader className="bg-zinc-300 text-white relative flex-shrink-0">
          <BaseNodeHeaderTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse"></div>
              转人工
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
                  <Label className="text-xs">消息模板</Label>
                  <Textarea
                    className="min-h-12 nodrag nowheel"
                    value={safeData.messageTemplate || ""}
                    onChange={(e) =>
                      patchConfig({ messageTemplate: e.target.value })
                    }
                  />
                </div>

                <Separator className="my-1" />

                <div className="grid gap-1">
                  <Label className="text-xs">通知渠道</Label>
                  <CommonCombobox<NotifyOption>
                    options={NOTIFY_OPTIONS}
                    value={(safeData.notifyChannels as string) || null}
                    onChange={(v) =>
                      patchConfig({
                        notifyChannels:
                          (v as HandoffNotifyChannel) || undefined,
                      })
                    }
                    placeholder="请选择渠道"
                    getOptionId={(o) => o.id}
                    getOptionLabel={(o) => o.label}
                    getOptionDescription={(o) => o.description}
                    className="nodrag"
                  />
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

export default HandOff;
