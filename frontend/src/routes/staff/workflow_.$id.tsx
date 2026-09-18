import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useCallback, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { RouteTransition } from "@comp/page-transition";
import i18nBase, { useTranslation } from "i18n";
import WorkflowEditor from "@comp/react-flow/workflow";
import { useWorkflowStore } from "@store/workflow";
import { useWorkflowTestChatStore } from "@store/workflow-test-chat";
import { apiClient } from "@lib/api-client";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  AppDots6Icon,
  useToast,
} from "tentix-ui";
import {
  ArrowLeft,
  MessageSquareDot,
  Settings,
  Save,
  Plus,
  Play,
  Bot,
  Heart,
  HelpCircle,
  Users,
  Square,
  Database,
} from "lucide-react";
import { NodeType } from "tentix-server/constants";
import { cn } from "@lib/utils";
import { useAiChatModal } from "@comp/react-flow/components/chat-modal/use-chat-modal";
import { createAndAddNode } from "@comp/react-flow/tools";

type WorkflowTestEnv = { zone: string; namespace: string };
const WORKFLOW_TEST_ENV_KEY_PREFIX = "workflowTestEnv:";

function getWorkflowTestEnvKey(workflowId: string) {
  return `${WORKFLOW_TEST_ENV_KEY_PREFIX}${workflowId}`;
}

function readWorkflowTestEnv(workflowId: string): WorkflowTestEnv {
  if (typeof window === "undefined") return { zone: "", namespace: "" };
  try {
    const raw = localStorage.getItem(getWorkflowTestEnvKey(workflowId));
    if (!raw) return { zone: "", namespace: "" };
    const parsed = JSON.parse(raw) as Partial<WorkflowTestEnv>;
    return {
      zone: typeof parsed.zone === "string" ? parsed.zone : "",
      namespace: typeof parsed.namespace === "string" ? parsed.namespace : "",
    };
  } catch {
    return { zone: "", namespace: "" };
  }
}

function writeWorkflowTestEnv(workflowId: string, env: WorkflowTestEnv) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getWorkflowTestEnvKey(workflowId), JSON.stringify(env));
}

function clearWorkflowTestEnv(workflowId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getWorkflowTestEnvKey(workflowId));
}

export const Route = createFileRoute("/staff/workflow_/$id")({
  head: ({ params }) => ({
    meta: [{ title: i18nBase.t("workflow_page_title", { id: params.id }) }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("workflow_page_title", { id });
  }, [id, t]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSaved = useWorkflowStore((s) => s.isSaved);
  const setIsSaved = useWorkflowStore((s) => s.setIsSaved);
  const { toast } = useToast();

  const { openUseChatModal, useChatModal } = useAiChatModal();

  // ===== 对话测试设置（仅对“对话测试”生效）=====
  const [testSettingsOpen, setTestSettingsOpen] = useState(false);
  const [testZone, setTestZone] = useState("");
  const [testNamespace, setTestNamespace] = useState("");

  const openTestSettings = useCallback(() => {
    const env = readWorkflowTestEnv(id);
    setTestZone(env.zone);
    setTestNamespace(env.namespace);
    setTestSettingsOpen(true);
  }, [id]);

  const handleSaveTestSettings = useCallback(() => {
    const zone = testZone.trim();
    const namespace = testNamespace.trim();

    if (!zone || !namespace) {
      toast({
        title: t("workflow_test_env_required"),
        description: t("workflow_test_env_description"),
        variant: "destructive",
      });
      return;
    }

    writeWorkflowTestEnv(id, { zone, namespace });
    toast({
      title: t("workflow_test_env_saved"),
      description: t("workflow_test_env_saved_description"),
    });
    setTestSettingsOpen(false);
  }, [id, testZone, testNamespace, toast, t]);

  const handleClearTestSettings = useCallback(() => {
    clearWorkflowTestEnv(id);
    setTestZone("");
    setTestNamespace("");
    toast({
      title: t("workflow_test_env_cleared"),
      description: t("workflow_test_env_cleared_description"),
    });
  }, [id, toast, t]);

  const nodeItems = useMemo(
    () => [
      { id: NodeType.START, label: t("rf.nodeType.start"), desc: t("workflow_node_start_description"), icon: Play },
      { id: NodeType.MCP, label: "MCP", desc: t("workflow_node_mcp_description"), icon: Bot },
      {
        id: NodeType.SMART_CHAT,
        label: t("rf.nodeType.smartChat"),
        desc: t("workflow_node_smart_chat_description"),
        icon: Bot,
      },
      {
        id: NodeType.RAG,
        label: t("rf.nodeType.rag"),
        desc: t("workflow_node_rag_description"),
        icon: Database,
      },
      {
        id: NodeType.EMOTION_DETECTOR,
        label: t("rf.nodeType.emotionDetector"),
        desc: t("workflow_node_emotion_description"),
        icon: Heart,
      },
      {
        id: NodeType.ESCALATION_OFFER,
        label: t("rf.nodeType.escalationOffer"),
        desc: t("workflow_node_escalation_description"),
        icon: HelpCircle,
      },
      { id: NodeType.HANDOFF, label: t("rf.nodeType.handoff"), desc: t("workflow_node_handoff_description"), icon: Users },
      { id: NodeType.END, label: t("rf.nodeType.end"), desc: t("workflow_node_end_description"), icon: Square },
    ],
    [t],
  );

  const handleDragStart = useCallback((e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleAddNode = useCallback((type: NodeType) => {
    const { idGenerator, addNode } = useWorkflowStore.getState();
    // 在画布中心位置添加节点
    const position = { x: 250, y: 250 };
    createAndAddNode(type, position, idGenerator, addNode);
  }, []);

  // 保存工作流的 mutation
  const saveWorkflowMutation = useMutation({
    mutationFn: async () => {
      // 获取最新的工作流状态
      const { nodes, edges } = useWorkflowStore.getState();
      const response = await apiClient.admin.workflow[":id"].$patch({
        param: { id },
        json: {
          nodes,
          edges,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      // 保存成功后，标记为已保存并使查询失效
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["admin-workflow", id] });
      toast({ title: t("workflow_save_success") });
    },
    onError: (error) => {
      console.error("Failed to save workflow:", error);
      toast({ title: t("workflow_save_failed"), variant: "destructive" });
    },
  });

  const handleSave = useCallback(() => {
    if (!isSaved && !saveWorkflowMutation.isPending) {
      saveWorkflowMutation.mutate();
    }
  }, [isSaved, saveWorkflowMutation]);

  const {
    data: wf,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-workflow", id],
    queryFn: async () => {
      const res = await apiClient.admin.workflow[":id"].$get({ param: { id } });
      return res.json();
    },
  });

  // 写入工作流到全局 store
  useEffect(() => {
    if (wf) {
      useWorkflowStore.getState().fromConfig(wf);
    }
    return () => {
      // 离开页面时清空，防止状态泄漏到其他页面
      useWorkflowStore.getState().clear();
    };
  }, [wf]);

  // Set currentWorkflowId when component mounts
  useEffect(() => {
    useWorkflowTestChatStore.getState().setCurrentWorkflowId(id);
    return () => {
      // 离开页面时清空 workflowId
      useWorkflowTestChatStore.getState().setCurrentWorkflowId(null);
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading Workflow...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : t("workflow_load_failed")}
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: "/staff/ai", search: { tab: "workflow" } })
            }
          >
            {t("workflow_back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <RouteTransition>
      <div className="relative h-screen w-full overflow-hidden">
        {/* 左上角：浮动操作按钮 */}
        <div className="absolute left-4 top-6 z-30">
          <div className="flex flex-col gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg"
                  onClick={() =>
                    navigate({ to: "/staff/ai", search: { tab: "workflow" } })
                  }
                >
                  <ArrowLeft className="!h-5 !w-5" strokeWidth={1.33} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {t("workflow_back")}
              </TooltipContent>
            </Tooltip>

            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full shadow-lg"
                    >
                      <Plus className="!h-5 !w-5" strokeWidth={1.33} />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {t("workflow_add_node")}
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side="right"
                sideOffset={12}
                className="w-[300px] max-h-[70vh] overflow-hidden rounded-2xl border border-border/50 bg-background/95 text-foreground shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/95 p-0"
              >
                <div className="p-3 space-y-1">
                  {nodeItems.map((n) => {
                    const IconComponent = n.icon;
                    return (
                      <div
                        key={n.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, n.id)}
                        className="group relative select-none cursor-grab active:cursor-grabbing rounded-xl bg-muted/60 hover:bg-muted transition-all duration-200 px-3 py-3 border border-transparent hover:border-border/20"
                      >
                        <div className="flex items-center gap-3">
                          {/* Left Icon */}
                          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                            <IconComponent
                              className="!h-4 !w-4 text-muted-foreground group-hover:text-foreground transition-colors"
                              strokeWidth={1.5}
                            />
                          </div>

                          {/* Center Text */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {n.label}
                            </div>
                          </div>

                          {/* Right Icons */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!h-6 !w-6 p-0 hover:bg-zinc-200 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleAddNode(n.id);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </Button>
                            <AppDots6Icon
                              className="!h-5 !w-5 text-muted-foreground group-hover:text-foreground transition-colors"
                              strokeWidth={1.5}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 右上角操作区 */}
        <div className="absolute right-4 top-6 z-20">
          <div className="flex items-center h-10 rounded-lg border border-zinc-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-center h-10 rounded-r-none border-l-0 rounded-l-lg border-r border-zinc-200 hover:bg-zinc-50 text-sm font-normal text-zinc-700"
                  onClick={() => openUseChatModal()}
                >
                  <MessageSquareDot className="h-4 w-4" strokeWidth={1.33} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={2}>
                <p>{t("workflow_test_chat")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-center h-10 rounded-r-none border-l-0 rounded-l-none border-r border-zinc-200 hover:bg-zinc-50 text-sm font-normal text-zinc-700"
                  onClick={openTestSettings}
                >
                  <Settings className="h-4 w-4" strokeWidth={1.33} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={2}>
                <p>{t("workflow_settings")}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-center gap-2 h-10 rounded-l-none border-l-0 border-r-0 rounded-r-lg border-zinc-200 hover:bg-zinc-50 text-sm font-normal text-zinc-700"
                  onClick={handleSave}
                  disabled={isSaved || saveWorkflowMutation.isPending}
                >
                  <Save className="h-4 w-4" strokeWidth={1.33} />
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      isSaved ? "bg-emerald-500" : "bg-red-500",
                    )}
                  ></div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={2}>
                <p>{t("workflow_save")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* 工作区 */}
        <div className="absolute inset-0">
          <div className="h-full w-full">
            <WorkflowEditor />
          </div>
        </div>
      </div>
      {/* modal */}
      {useChatModal}

      {/* 右上角设置：仅用于“对话测试”的 zone/namespace 配置 */}
      <Dialog open={testSettingsOpen} onOpenChange={setTestSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("workflow_test_settings_title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              {t("workflow_test_settings_description")}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Zone</div>
              <Input
                value={testZone}
                onChange={(e) => setTestZone(e.target.value)}
                placeholder={t("workflow_test_zone_placeholder")}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Namespace</div>
              <Input
                value={testNamespace}
                onChange={(e) => setTestNamespace(e.target.value)}
                placeholder={t("workflow_test_namespace_placeholder")}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setTestSettingsOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button variant="outline" onClick={handleClearTestSettings}>
                {t("workflow_test_settings_clear")}
              </Button>
              <Button onClick={handleSaveTestSettings}>{t("workflow_save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </RouteTransition>
  );
}
