import React, { useCallback, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@comp/react-flow/ui/base-node";
import { WorkflowHandle } from "@comp/react-flow/ui/workflow-handle";
import { useWorkflowStore } from "@store/workflow";

import {
  NodeType,
  type HandleConfig,
  type McpConfig,
} from "tentix-server/constants";
import {
  Switch,
  Label,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  ScrollArea,
  ScrollBar,
} from "tentix-ui";
import { WorkflowTextarea } from "@comp/react-flow/components/workflow-textarea";
import { useTranslation } from "i18n";

type McpNodeData = (McpConfig["config"] & {
  name: string;
  handles?: HandleConfig[];
  description?: string;
});

const Mcp: React.FC<NodeProps<Node<McpNodeData>>> = ({ id, data }) => {
  const { t } = useTranslation();
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const safeData = useMemo<McpNodeData>(() => data ?? { name: "" }, [data]);

  const patchConfig = useCallback(
    (patch: Partial<McpConfig["config"]>) => {
      updateNode(id, (prev) => {
        if (prev.type !== NodeType.MCP) return prev;
        const typedPrev = prev as McpConfig;
        const prevConfig: McpConfig["config"] =
          typedPrev.config ?? ({} as McpConfig["config"]);
        const nextConfig: McpConfig["config"] = { ...prevConfig, ...patch };
        return { ...typedPrev, config: nextConfig };
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

  const enabled = safeData.enabled !== false;

  const baseUrl = (safeData.baseUrl ?? "") as string;
const apis = (safeData.apis ?? []) as NonNullable<McpConfig["config"]["apis"]>;
const selectedApiId = (safeData.selectedApiId ?? "") as string;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const addApi = () => {
  const id = newId();
  const nextApis = [
    ...apis,
    { id, name: "", method: "GET" as const, path: "" },
  ];
  patchConfig({
    apis: nextApis,
    selectedApiId: selectedApiId || id,
  });
};

const updateApi = (id: string, patch: Partial<(typeof apis)[number]>) => {
  const nextApis = apis.map((a) => (a.id === id ? { ...a, ...patch } : a));
  patchConfig({ apis: nextApis });
};

const removeApi = (id: string) => {
  const nextApis = apis.filter((a) => a.id !== id);
  const nextSelected =
    selectedApiId === id ? (nextApis[0]?.id ?? undefined) : selectedApiId || undefined;

  patchConfig({
    apis: nextApis,
    selectedApiId: nextSelected,
  });
};



  return (
    <div className="relative group">
      <BaseNode className="w-[300px] h-[540px] bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg overflow-hidden flex flex-col pb-3">
        <BaseNodeHeader className="bg-zinc-300 text-white relative flex-shrink-0">
          <BaseNodeHeaderTitle className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              MCP
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
              <div className="text-xs text-muted-foreground mb-3"></div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t("rf.mcp.enabled")}</Label>
                <Switch
                  className="nodrag"
                  checked={enabled}
                  onCheckedChange={(v) => patchConfig({ enabled: v })}
                />
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between">
                <Label className="text-sm">是否在 Sealos 上运行</Label>
                <Switch
                  className="nodrag"
                  checked={!!safeData.isSealosRuntime}
                  onCheckedChange={(v) =>
                    patchConfig({ isSealosRuntime: v })
                  }
                />
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                <Label className="text-sm">Base URL</Label>
                <Input
                  className="nodrag"
                  value={baseUrl}
                  placeholder="http://127.0.0.1:8787"
                  onChange={(e) => patchConfig({ baseUrl: e.target.value })}
                />
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t("rf.mcp.ai_auto_select_api")}</Label>
                <Switch
                  className="nodrag"
                  checked={!!safeData.enableAiSelection}
                  onCheckedChange={(v) => patchConfig({ enableAiSelection: v })}
                />
              </div>

              <div className="mt-2 space-y-2">
                <Label className="text-sm">System Prompt</Label>
                <WorkflowTextarea
                  className="min-h-[100px]"
                  value={(safeData.systemPrompt ?? "") as string}
                  placeholder={
                    t("rf.mcp.system_prompt_placeholder") as string
                  }
                  onChange={(value) => patchConfig({ systemPrompt: value })}
                  nodeId={id}
                />
              </div>

              <div className="mt-2 space-y-2">
                <Label className="text-sm">User Prompt</Label>
                <WorkflowTextarea
                  className="min-h-[100px]"
                  value={(safeData.userPrompt ?? "") as string}
                  placeholder={
                    t("rf.mcp.user_prompt_placeholder") as string
                  }
                  onChange={(value) => patchConfig({ userPrompt: value })}
                  nodeId={id}
                />
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {t("rf.mcp.ai_selection_hint")}
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t("rf.mcp.supported_apis")}</Label>
                  <Button
                    className="nodrag"
                    variant="outline"
                    size="sm"
                    onClick={addApi}
                  >
                    {t("rf.mcp.add_api")}
                  </Button>
                </div>

                {apis.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {t("rf.mcp.empty_api_hint")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apis.map((a) => (
                      <div key={a.id} className="rounded-md border p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            className="nodrag"
                            value={a.name}
                            placeholder="name"
                            onChange={(e) =>
                              updateApi(a.id, { name: e.target.value })
                            }
                          />

                          <Select
                            value={a.method}
                            onValueChange={(v) =>
                              updateApi(a.id, { method: v as "GET" | "POST" })
                            }
                          >
                            <SelectTrigger className="nodrag w-[110px]">
                              <SelectValue placeholder="method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            className="nodrag"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeApi(a.id)}
                          >
                            {t("rf.mcp.delete_api")}
                          </Button>
                        </div>

                        <Input
                          className="nodrag"
                          value={a.path}
                          placeholder={t("rf.mcp.api_path_placeholder") as string}
                          onChange={(e) =>
                            updateApi(a.id, { path: e.target.value })
                          }
                        />

                        <div className="text-[11px] text-muted-foreground font-mono">
                          id={a.id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                <Label className="text-sm">{t("rf.mcp.selected_api")}</Label>
                <Select
                  value={selectedApiId || ""}
                  onValueChange={(v) =>
                    patchConfig({ selectedApiId: v || undefined })
                  }
                  disabled={apis.length === 0}
                >
                  <SelectTrigger className="nodrag">
                    <SelectValue
                      placeholder={
                        apis.length
                          ? (t("rf.mcp.select_api") as string)
                          : (t("rf.mcp.add_api_first") as string)
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {apis.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.method} {a.path})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                {t("rf.mcp.fallback_api_hint")}
                <div className="mt-1 font-mono">
                </div>
              </div>
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </BaseNodeContent>
      </BaseNode>

      {/* Input handles */}
      {(safeData.handles ?? [])
        .filter((h: HandleConfig) => h.type === "target")
        .map((h: HandleConfig) => (
          <WorkflowHandle key={h.id} handle={h} />
        ))}

      {/* Output handles */}
      {(safeData.handles ?? [])
        .filter((h: HandleConfig) => h.type === "source")
        .map((h: HandleConfig, index: number) => (
          <WorkflowHandle key={h.id} handle={h} index={index} />
        ))}
    </div>
  );
};

export default Mcp;
