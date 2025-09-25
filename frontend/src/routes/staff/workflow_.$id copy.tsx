import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RouteTransition } from "@comp/page-transition";
import WorkflowEditor from "@comp/react-flow/workflow";
import { useWorkflowStore } from "@store/workflow";
import { apiClient } from "@lib/api-client";
import { Button } from "tentix-ui";
import { ArrowLeft, Play, Save } from "lucide-react";
import type { WorkflowConfig } from "tentix-server/constants";

export const Route = createFileRoute("/staff/workflow_/$id copy")({
  head: ({ params }) => ({
    meta: [{ title: `工作流 #${params.id} | Tentix` }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const storeNodes = useWorkflowStore((s) => s.nodes);
  const storeEdges = useWorkflowStore((s) => s.edges);

  const {
    data: wf,
    isLoading,
    isError,
    error,
  } = useQuery<WorkflowConfig>({
    queryKey: ["admin-workflow", id],
    queryFn: async () => {
      const res = await apiClient.admin.workflow[":id"].$get({ param: { id } });
      return res.json() as Promise<WorkflowConfig>;
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
        {/* 左上角：返回 + 标题信息 */}
        <div className="absolute left-4 top-4 z-20 flex items-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 hover:bg-background"
            onClick={() =>
              navigate({ to: "/staff/ai", search: { tab: "workflow" } })
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 select-none">
            <div className="text-sm font-medium text-foreground truncate max-w-[40vw]">
              {wf?.name ?? "工作流"}
            </div>
            {wf?.description ? (
              <div className="text-xs text-muted-foreground truncate max-w-[40vw]">
                {wf.description}
              </div>
            ) : null}
          </div>
        </div>

        {/* 右上角操作区 */}
        <div className="absolute right-4 top-4 z-20">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/90 px-2 py-1 shadow-sm supports-[backdrop-filter]:bg-card/70">
              <Button variant="ghost" className="h-8 gap-1.5 px-3">
                <Play className="h-4 w-4" />
                <span>对话测试</span>
              </Button>
              <Button className="h-8 gap-1.5 px-3">
                <Save className="h-4 w-4" />
                <span>保存工作流</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 工作区 */}
        <div className="absolute inset-0">
          <div className="h-full w-full">
            {Array.isArray(storeNodes) &&
            storeNodes.length > 0 &&
            Array.isArray(storeEdges) &&
            storeEdges.length > 0 ? (
              <WorkflowEditor />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                该工作流暂无可视节点或连线
              </div>
            )}
          </div>
        </div>
      </div>
    </RouteTransition>
  );
}
