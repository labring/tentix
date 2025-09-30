import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { RouteTransition } from "@comp/page-transition";
import WorkflowEditor from "@comp/react-flow/workflow";
import { useWorkflowStore } from "@store/workflow";
import { apiClient } from "@lib/api-client";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
} from "lucide-react";
import { NodeType, type HandleConfig } from "tentix-server/constants";
import { cn } from "@lib/utils";
import { useAiChatModal } from "@comp/react-flow/components/use-chat-modal";

export const Route = createFileRoute("/staff/workflow_/$id")({
  head: ({ params }) => ({
    meta: [{ title: `工作流 #${params.id} | Tentix` }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSaved = useWorkflowStore((s) => s.isSaved);
  const setIsSaved = useWorkflowStore((s) => s.setIsSaved);
  const { toast } = useToast();

  const { openUseChatModal, useChatModal } = useAiChatModal();

  const nodeItems = useMemo(
    () => [
      { id: NodeType.START, label: "开始", desc: "入口节点", icon: Play },
      {
        id: NodeType.SMART_CHAT,
        label: "智能聊天",
        desc: "AI 对话",
        icon: Bot,
      },
      {
        id: NodeType.EMOTION_DETECTOR,
        label: "情绪检测",
        desc: "识别情绪",
        icon: Heart,
      },
      {
        id: NodeType.ESCALATION_OFFER,
        label: "升级询问",
        desc: "是否升级",
        icon: HelpCircle,
      },
      { id: NodeType.HANDOFF, label: "转人工", desc: "人工接管", icon: Users },
      { id: NodeType.END, label: "结束", desc: "终点", icon: Square },
    ],
    [],
  );

  const handleDragStart = useCallback((e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleAddNode = useCallback((type: NodeType) => {
    const { idGenerator, addNode } = useWorkflowStore.getState();

    // 构造一个基础节点配置，handles 尽量通用
    const createDefaultHandles = (
      nodeId: string,
      type: NodeType,
    ): HandleConfig[] => {
      if (type === NodeType.START)
        return [
          {
            id: idGenerator.generateHandleId(nodeId, "out"),
            type: "source",
            position: "right",
          },
        ];
      if (type === NodeType.END)
        return [
          {
            id: idGenerator.generateHandleId(nodeId, "in"),
            type: "target",
            position: "left",
          },
        ];
      return [
        {
          id: idGenerator.generateHandleId(nodeId, "in"),
          type: "target",
          position: "left",
        },
        {
          id: idGenerator.generateHandleId(nodeId, "out"),
          type: "source",
          position: "right",
        },
      ];
    };

    // 在画布中心位置添加节点
    const position = { x: 250, y: 250 };

    const nodeType = type;
    const nodeId = idGenerator.generateNodeId(nodeType);
    addNode({
      id: nodeId,
      type: nodeType,
      name: nodeId,
      position,
      handles: createDefaultHandles(nodeId, nodeType),
      description: undefined,
    });
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
      toast({ title: "工作流保存成功" });
    },
    onError: (error) => {
      console.error("Failed to save workflow:", error);
      toast({ title: "工作流保存失败，请重试", variant: "destructive" });
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
      useWorkflowStore.getState().setNodes([]);
      useWorkflowStore.getState().setEdges([]);
    };
  }, [wf]);

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
            {error instanceof Error ? error.message : "加载失败"}
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: "/staff/ai", search: { tab: "workflow" } })
            }
          >
            返回
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
                返回
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
                  添加节点
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
                <p>对话测试</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-center h-10 rounded-r-none border-l-0 rounded-l-none border-r border-zinc-200 hover:bg-zinc-50 text-sm font-normal text-zinc-700"
                  onClick={() => () => {}}
                >
                  <Settings className="h-4 w-4" strokeWidth={1.33} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={2}>
                <p>设置</p>
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
                <p>保存</p>
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
    </RouteTransition>
  );
}
