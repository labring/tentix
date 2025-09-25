import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StaffSidebar } from "@comp/staff/sidebar";
import { RouteTransition } from "@comp/page-transition";
import WorkflowEditor from "@comp/react-flow/workflow";
import { useWorkflowStore } from "@store/workflow";
import { apiClient } from "@lib/api-client";
import { Button, Card, CardContent } from "tentix-ui";
import { ArrowLeft, GitBranch } from "lucide-react";
import type { WorkflowConfig } from "tentix-server/constants";

export const Route = createFileRoute("/staff/workflow_/$id")({
  head: ({ params }) => ({
    meta: [{ title: `工作流 #${params.id} | Tentix` }],
  }),
  component: RouteComponent,
});

function formatRelativeFromNow(iso?: string): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  const now = Date.now();
  let diff = Math.floor((now - ts) / 1000);
  if (!isFinite(diff)) return "";
  if (diff < 0) diff = 0;
  if (diff < 45) return "刚刚";
  if (diff < 90) return "1 分钟前";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} 个月前`;
  const y = Math.floor(mo / 12);
  return `${y} 年前`;
}

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

  const title = useMemo(() => wf?.name ?? "工作流", [wf?.name]);
  const subTitle = useMemo(() => {
    if (!wf) return "";
    return `最近更新于 ${formatRelativeFromNow(wf.updatedAt)}`;
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
            onClick={() => navigate({ to: "/staff/ai" })}
          >
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <RouteTransition>
      <div className="flex h-screen w-full overflow-hidden">
        <StaffSidebar />
        <div className="flex-1 h-full overflow-hidden">
          {/* 顶部导航区 */}
          <div className="px-6 pt-6">
            <Card className="border border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate({ to: "/staff/ai" })}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate max-w-[60vw]">
                          {title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[60vw]">
                          {subTitle}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 工作区 */}
          <div className="h-[calc(100%-5.5rem)] px-6 pb-6 pt-4">
            <div className="h-full w-full rounded-xl border border-border/50 overflow-hidden">
              {Array.isArray(storeNodes) && storeNodes.length > 0 &&
              Array.isArray(storeEdges) && storeEdges.length > 0 ? (
                <WorkflowEditor />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  该工作流暂无可视节点或连线
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RouteTransition>
  );
}
