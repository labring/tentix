import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { StaffSidebar } from "@comp/staff/sidebar";
import { RouteTransition } from "@comp/page-transition";
import {
  Card,
  CardHeader,
  CardContent,
  Input,
  Button,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  toast,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Avatar,
  AvatarImage,
  AvatarFallback,
  EmptyStateIcon,
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemTitle,
  ItemDescription,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "tentix-ui";
import {
  useMemo,
  useState,
  useCallback,
  Suspense,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "i18n";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { apiClient, kbAdminSaveFetch } from "@lib/api-client";
import {
  Search,
  Plus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Trash2,
  Camera,
  RefreshCw,
  ExternalLink,
  Database,
  Save,
  Sparkles,
} from "lucide-react";
import { uploadAvatar, deleteOldAvatar } from "@utils/avatar-manager";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { WorkflowBasicResponseType } from "tentix-server/rpc";
import { CommonCombobox } from "@comp/common/combobox";
import { Tabs } from "@comp/common/tabs";
import useDebounce from "@hook/use-debounce";
import { useSettingsModal } from "@modal/use-settings-modal";
import { useTicketModules } from "@store/app-config";
import { cn } from "@lib/utils";

function getErrorMessage(err: unknown, fallback = "操作失败"): string {
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : fallback;
  }
  return fallback;
}

const createWorkflowFormSchema = z.object({
  name: z.string().min(1, "名称不能为空").trim(),
  description: z.string().trim(),
});

type CreateWorkflowFormData = z.infer<typeof createWorkflowFormSchema>;

const aiRoleConfigsQueryOptions = (keyword?: string) => {
  const normalized = (keyword ?? "").trim();
  return queryOptions({
    queryKey: ["admin-ai-role-configs-all", normalized],
    queryFn: async () => {
      const res = await apiClient.admin["ai-role-config"]["all"].$get({
        query: { keyword: normalized || undefined },
      });
      return await res.json();
    },
  });
};

const workflowsBasicQueryOptions = (keyword?: string) => {
  const normalized = (keyword ?? "").trim();
  return queryOptions({
    queryKey: ["admin-workflows-basic", normalized],
    queryFn: async () => {
      const res = await apiClient.admin.workflow.basic.$get({
        query: { keyword: normalized || undefined },
      });
      return await res.json();
    },
  });
};

type KnowledgeSourceType =
  | "favorited_conversation"
  | "historical_ticket"
  | "general_knowledge";

type KnowledgeStatusFilter = "all" | "enabled" | "disabled";

type KnowledgeListFilters = {
  keyword: string;
  sourceType: "all" | KnowledgeSourceType;
  module: string;
  status: KnowledgeStatusFilter;
  failedOnly: boolean;
  page: number;
  pageSize: number;
};

type KnowledgeListItem = {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  module: string;
  category: string;
  chunkCount: number;
  disabledChunkCount: number;
  accessCount: number;
  isDeleted: boolean;
  updatedAt: string;
  syncFailed: boolean;
  syncedAt: string | null;
};

type KnowledgeChunk = {
  id: string;
  chunkId: number;
  title: string;
  content: string;
  metadata: unknown;
  score: number;
  accessCount: number;
  lang: string | null;
  tokenCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeSelectionMode = "selected_messages" | "entire_conversation";

type KnowledgeSourceMessage = {
  id: number;
  ticketId: string;
  senderId: number;
  senderName: string;
  senderRole: string | null;
  senderRoleLabel: string;
  createdAt: string;
  isInternal: boolean;
  withdrawn: boolean;
  contentText: string;
};

type KnowledgeDetail = {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  module: string;
  category: string;
  area: string;
  tags: string[];
  problemSummary: string;
  isDeleted: boolean;
  accessCount: number;
  syncFailed: boolean;
  syncedAt: string | null;
  ticketId: string | null;
  selectionMode: KnowledgeSelectionMode | null;
  sourceMessages: KnowledgeSourceMessage[];
  createdAt: string;
  updatedAt: string;
  chunks: KnowledgeChunk[];
};

type KnowledgeListResponse = {
  items: KnowledgeListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    enabledCount: number;
    disabledCount: number;
    chunkCount: number;
    failedSyncCount: number;
  };
  filters: {
    modules: string[];
  };
};

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  favorited_conversation: "精选案例",
  historical_ticket: "历史工单",
  general_knowledge: "通用知识",
};

const SOURCE_DOT: Record<KnowledgeSourceType, string> = {
  favorited_conversation: "bg-orange-500",
  historical_ticket: "bg-blue-500",
  general_knowledge: "bg-emerald-500",
};

function makeKnowledgeKey(item: Pick<KnowledgeListItem, "sourceType" | "sourceId">) {
  return `${item.sourceType}:${item.sourceId}`;
}

const knowledgeBaseQueryOptions = (filters: KnowledgeListFilters) => {
  const normalized = filters.keyword.trim();
  return queryOptions({
    queryKey: ["admin-knowledge-base", filters, normalized],
    queryFn: async (): Promise<KnowledgeListResponse> => {
      const res = await apiClient.kb.admin.items.$get({
        query: {
          page: String(filters.page),
          pageSize: String(filters.pageSize),
          keyword: normalized || undefined,
          sourceType: filters.sourceType === "all" ? undefined : filters.sourceType,
          module: filters.module === "all" ? undefined : filters.module,
          status: filters.status === "all" ? undefined : filters.status,
          failedOnly: filters.failedOnly ? "true" : undefined,
        },
      });
      return (await res.json()) as KnowledgeListResponse;
    },
  });
};

const knowledgeDetailQueryOptions = (
  sourceType: KnowledgeSourceType | undefined,
  sourceId: string | undefined,
) =>
  queryOptions({
    queryKey: ["admin-knowledge-base-detail", sourceType, sourceId],
    queryFn: async (): Promise<KnowledgeDetail> => {
      if (!sourceType || !sourceId) {
        throw new Error("Missing knowledge source");
      }
      const res = await apiClient.kb.admin.items[":sourceType"][":sourceId"].$get({
        param: { sourceType, sourceId },
      });
      return (await res.json()) as KnowledgeDetail;
    },
  });

// 为列表图标提供一组可选的 Tailwind 色系（文本+浅色背景）
const TAILWIND_COLOR_COMBOS: string[] = [
  "bg-rose-100 text-rose-600",
  "bg-pink-100 text-pink-600",
  "bg-fuchsia-100 text-fuchsia-600",
  "bg-purple-100 text-purple-600",
  "bg-violet-100 text-violet-600",
  "bg-indigo-100 text-indigo-600",
  "bg-blue-100 text-blue-600",
  "bg-sky-100 text-sky-600",
  "bg-cyan-100 text-cyan-600",
  "bg-teal-100 text-teal-600",
  "bg-emerald-100 text-emerald-600",
  "bg-green-100 text-green-600",
  "bg-lime-100 text-lime-600",
  "bg-amber-100 text-amber-600",
  "bg-orange-100 text-orange-600",
  "bg-red-100 text-red-600",
];

// 基于 id 生成稳定索引，避免每次渲染颜色变化
function getColorById(id: string | number): string {
  const text = String(id);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const idx = hash % TAILWIND_COLOR_COMBOS.length;
  const color = TAILWIND_COLOR_COMBOS[idx];
  return typeof color === "string" && color
    ? color
    : "bg-primary/10 text-primary";
}

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  const locale =
    typeof navigator !== "undefined" && (navigator as Navigator).language
      ? (navigator as Navigator).language
      : "en-US";
  return new Date(iso).toLocaleString(locale as string);
}

// 将 ISO 时间格式化为相对时间（中文）
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

export const Route = createFileRoute("/staff/ai")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || undefined,
  }),
  component: RouteComponent,
});

export function RouteComponent() {
  const { tab: searchTab } = Route.useSearch();
  const [tab, setTab] = useState<"ai" | "workflow" | "knowledge">("ai");

  useEffect(() => {
    if (
      searchTab === "workflow" ||
      searchTab === "ai" ||
      searchTab === "knowledge"
    ) {
      setTab(searchTab);
    }
  }, [searchTab]);

  const tabs = useMemo(
    () => [
      {
        key: "ai",
        label: "AI角色",
        content: (
          <Suspense fallback={<AiRolesSkeleton />}>
            <AiRolesTab />
          </Suspense>
        ),
      },
      {
        key: "workflow",
        label: "工作流",
        content: <WorkflowsTab />,
      },
      {
        key: "knowledge",
        label: "知识库",
        content: <KnowledgeBaseTab />,
      },
    ],
    [],
  );

  return (
    <RouteTransition>
      <div className="flex h-screen w-full overflow-hidden">
        <StaffSidebar />
        <div className="flex-1 h-full overflow-hidden flex flex-col px-6 py-6">
          <Tabs
            tabs={tabs}
            activeTab={tab}
            onTabChange={(tabKey) =>
              setTab(tabKey as "ai" | "workflow" | "knowledge")
            }
            className="h-full"
          />
        </div>
      </div>
    </RouteTransition>
  );
}

// Skeleton for AI Roles Tab
function AiRolesSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-border/50 p-4 animate-pulse"
        >
          <div className="h-5 w-1/3 bg-muted rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-9 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// AI角色 Tab
function AiRolesTab() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="搜索 AI 角色"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <Suspense fallback={<AiRolesSkeleton />}>
        <AiRolesList keyword={debouncedKeyword} />
      </Suspense>
    </div>
  );
}

// 子列表：局部 Suspense 内查询，避免输入框丢焦点
function AiRolesList({ keyword }: { keyword: string }) {
  const queryClient = useQueryClient();
  const { data: aiUsers } = useSuspenseQuery(aiRoleConfigsQueryOptions(keyword));
  const { data: allWorkflows } = useSuspenseQuery(workflowsBasicQueryOptions());
  const ticketModules = useTicketModules();
  const { i18n } = useTranslation();
  const currentLang: "zh-CN" | "en-US" = i18n.language === "zh" ? "zh-CN" : "en-US";
  const fileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const setFileInputRef =
    (id: number) =>
    (el: HTMLInputElement | null): void => {
      fileInputsRef.current[id] = el;
    };

  const updateAiRoleConfigMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { workflowId?: string | null; isActive?: boolean; scope?: string };
    }) => {
      const res = await apiClient.admin["ai-role-config"][":id"].$patch({
        param: { id: String(id) },
        json: data,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "更新失败"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-ai-role-configs-all"],
      });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, "更新失败"),
        variant: "destructive",
      });
    },
  });

  // Admin update AI user's basic fields
  const updateAiUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; avatar?: string };
    }) => {
      const res = await apiClient.admin["ai-user"][":id"].$patch({
        param: { id: String(id) },
        json: data,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "更新失败"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-ai-role-configs-all"],
      });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, "更新失败"),
        variant: "destructive",
      });
    },
  });

  const handleTriggerUpload = (id: number) => {
    const el = fileInputsRef.current[id];
    el?.click();
  };

  const handleAvatarChange = async (id: number, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "请选择图片文件", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "图片大小不能超过5MB", variant: "destructive" });
      return;
    }
    try {
      setUploadingId(id);
      const url = await uploadAvatar(file, id);
      const oldUrl = aiUsers.find((x) => x.id === id)?.avatar || "";
      await updateAiUserMutation.mutateAsync({ id, data: { avatar: url } });
      if (oldUrl) {
        // 删除旧头像文件（忽略错误）
        deleteOldAvatar(oldUrl).catch((err) => {
          console.error("删除旧头像文件失败:", err);
        });
      }
      toast({ title: "头像已更新" });
    } catch (e) {
      toast({
        title: getErrorMessage(e, "头像更新失败"),
        variant: "destructive",
      });
    } finally {
      setUploadingId(null);
      const el = fileInputsRef.current[id];
      if (el) el.value = "";
    }
  };

  const handleNameBlur = async (id: number) => {
    const name = nameDrafts[id]?.trim();
    if (!name) return;
    try {
      await updateAiUserMutation.mutateAsync({ id, data: { name } });
      toast({ title: "名称已更新" });
    } catch (e) {
      toast({
        title: getErrorMessage(e, "名称更新失败"),
        variant: "destructive",
      });
    }
  };

  if (aiUsers.length === 0) {
    return <AiRolesEmptyState />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {aiUsers.map((u) => (
        <Card
          key={u.id}
          className="rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 ease-out border border-border/50 hover:border-border/80 relative group bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60 transform-gpu hover:-translate-y-[1px]"
        >
          <div className="h-full">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 ring-1 ring-border/60">
                    <AvatarImage src={u.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{u.name?.[0] || "A"}</AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full p-0 bg-background/90"
                    onClick={() => handleTriggerUpload(u.id)}
                    disabled={
                      uploadingId === u.id || updateAiUserMutation.isPending
                    }
                  >
                    <Camera className="h-3 w-3" />
                  </Button>
                  <input
                    ref={setFileInputRef(u.id)}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleAvatarChange(u.id, e.target.files?.[0])
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    defaultValue={u.name}
                    onChange={(e) =>
                      setNameDrafts((prev) => ({
                        ...prev,
                        [u.id]: e.target.value,
                      }))
                    }
                    onBlur={() => handleNameBlur(u.id)}
                    placeholder="输入名称"
                    className="h-10 bg-transparent px-0 rounded-none border-0 border-b border-border/70 focus:border-foreground/80 focus-visible:ring-0 focus:ring-0 focus:outline-none shadow-none"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2 pb-5">
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="w-16 shrink-0 text-right text-[13px] text-muted-foreground">回答范围</div>
                  <div className="flex-1 max-w-[260px]">
                    <CommonCombobox<{ id: string; name: string; code: string }>
                      options={[
                        {
                          id: "default_all",
                          name: currentLang === "zh-CN" ? "全部范围" : "All modules",
                          code: "default_all",
                        },
                        ...ticketModules.map((m) => ({
                          id: m.code,
                          name: m.translations?.[currentLang] || m.code,
                          code: m.code,
                        })),
                      ]}
                      value={u.aiRoleConfig?.scope ?? "default_all"}
                      onChange={(scope) =>
                        updateAiRoleConfigMutation.mutate(
                          { id: u.id, data: { scope: scope || "default_all" } },
                          { onSuccess: () => toast({ title: "已更新回答范围" }) },
                        )
                      }
                      disabled={updateAiRoleConfigMutation.isPending}
                      placeholder={currentLang === "zh-CN" ? "选择范围" : "Select scope"}
                      searchPlaceholder="搜索范围..."
                      noneLabel={undefined}
                      showNoneOption={false}
                      getOptionId={(o) => o.id}
                      getOptionLabel={(o) => o.name}
                      getOptionDescription={(o) => (o.id === "default_all" ? undefined : o.code)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-16 shrink-0 text-right text-[13px] text-muted-foreground">工作流</div>
                  <div className="flex-1 max-w-[260px]">
                    <CommonCombobox<WorkflowBasicResponseType>
                      options={allWorkflows}
                      value={u.aiRoleConfig?.workflowId ?? null}
                      onChange={(workflowId) => {
                        updateAiRoleConfigMutation.mutate(
                          { id: u.id, data: { workflowId } },
                          {
                            onSuccess: () => {
                              toast({ title: "已更新工作流" });
                            },
                          },
                        );
                      }}
                      disabled={updateAiRoleConfigMutation.isPending}
                      placeholder={currentLang === "zh-CN" ? "选择工作流" : "Select workflow"}
                      searchPlaceholder="搜索工作流..."
                      noneLabel="不绑定工作流"
                      showNoneOption
                      getOptionId={(o) => o.id}
                      getOptionLabel={(o) => o.name}
                      getOptionDescription={(o) => o.description}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60" />

              {u.aiRoleConfig?.createdAt || u.aiRoleConfig?.updatedAt ? (
                <div className="flex items-center text-xs text-muted-foreground">
                  {u.aiRoleConfig?.createdAt ? (
                    <span>创建：{formatDateTime(u.aiRoleConfig.createdAt)}</span>
                  ) : null}
                  {u.aiRoleConfig?.createdAt && u.aiRoleConfig?.updatedAt ? (
                    <span
                      aria-hidden
                      className="mx-4 h-[14px] w-px bg-border/60 inline-block"
                    />
                  ) : null}
                  {u.aiRoleConfig?.updatedAt ? (
                    <span>更新：{formatDateTime(u.aiRoleConfig.updatedAt)}</span>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center">
                <div className="w-16 shrink-0 text-right text-[13px] text-muted-foreground">激活状态</div>
                <div className="flex-1" />
                <Switch
                  checked={u.aiRoleConfig?.isActive ?? false}
                  disabled={updateAiRoleConfigMutation.isPending}
                  onCheckedChange={(checked) => {
                    updateAiRoleConfigMutation.mutate(
                      { id: u.id, data: { isActive: checked } },
                      {
                        onSuccess: () => {
                          toast({ title: "已更新激活状态" });
                        },
                      },
                    );
                  }}
                />
              </div>
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  );
}

// 工作流 Tab
function WorkflowsTab() {
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const debouncedKeyword = useDebounce(keyword, 300);

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.admin.workflow[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "删除失败"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "已删除" });
      queryClient.invalidateQueries({ queryKey: ["admin-workflows-basic"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-ai-role-configs-all"],
      });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, "删除失败"),
        variant: "destructive",
      });
    },
  });

  const handleCreateSuccess = useCallback(() => {
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["admin-workflows-basic"] });
    queryClient.invalidateQueries({ queryKey: ["admin-ai-role-configs-all"] });
  }, [queryClient]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="搜索工作流"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <Button onClick={() => setOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          New Flow
        </Button>
      </div>

      <Suspense fallback={<WorkflowsListSkeleton />}>
        <WorkflowsList
          keyword={debouncedKeyword}
          onDelete={(id) => deleteWorkflowMutation.mutate(id)}
        />
      </Suspense>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建工作流</DialogTitle>
          </DialogHeader>
          <CreateWorkflowForm onCreated={handleCreateSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateWorkflowForm({ onCreated }: { onCreated: () => void }) {
  const form = useForm<CreateWorkflowFormData>({
    resolver: zodResolver(createWorkflowFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: CreateWorkflowFormData) => {
      const res = await apiClient.admin.workflow.$post({
        json: {
          name: data.name,
          description: data.description,
          nodes: [],
          edges: [],
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "创建失败"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "创建成功" });
      form.reset();
      onCreated();
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, "创建失败"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateWorkflowFormData) => {
    createWorkflowMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名称</FormLabel>
              <FormControl>
                <Input placeholder="请输入名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>描述</FormLabel>
              <FormControl>
                <Input placeholder="可选" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={createWorkflowMutation.isPending}>
            {createWorkflowMutation.isPending ? "创建中..." : "提交"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// 子列表：局部 Suspense 内查询，避免输入框丢焦点
function WorkflowsList({
  keyword,
  onDelete,
}: {
  keyword: string;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { data: workflows } = useSuspenseQuery(
    workflowsBasicQueryOptions(keyword),
  );
  return (
    <ItemGroup>
      {workflows.map((wf) => (
        <Item
          key={wf.id}
          asChild
          className="cursor-pointer border-transparent hover:border-border/50 hover:bg-accent/50"
          onClick={() =>
            navigate({ to: "/staff/workflow/$id", params: { id: wf.id } })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate({ to: "/staff/workflow/$id", params: { id: wf.id } });
            }
          }}
        >
          <div role="button" tabIndex={0}>
            <ItemMedia variant="icon" className={getColorById(wf.id)}>
              <GitBranch className="h-5 w-5" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{wf.name}</ItemTitle>
              <ItemDescription>
                最近编辑于 {formatRelativeFromNow(wf.updatedAt)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() =>
                      navigate({ to: "/staff/workflow/$id", params: { id: wf.id } })
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(wf.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemActions>
          </div>
        </Item>
      ))}
    </ItemGroup>
  );
}

function WorkflowsListSkeleton() {
  return (
    <ItemGroup>
      {Array.from({ length: 6 }).map((_, idx) => (
        <Item key={idx} className="animate-pulse">
          <ItemMedia variant="icon">
            <div className="h-5 w-5 bg-muted rounded" />
          </ItemMedia>
          <ItemContent>
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="h-3 w-64 bg-muted rounded mt-2" />
          </ItemContent>
          <ItemActions>
            <div className="h-8 w-8 bg-muted rounded" />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}

function KnowledgeBaseTab() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);
  const [sourceType, setSourceType] =
    useState<KnowledgeListFilters["sourceType"]>("all");
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState<KnowledgeStatusFilter>("all");
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [selectedKnowledge, setSelectedKnowledge] = useState<Pick<KnowledgeListItem, "sourceType" | "sourceId"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const resetListPage = useCallback(() => {
    setPage(1);
  }, []);
  const resetStatusFilters = useCallback(() => {
    setStatus("all");
    setFailedOnly(false);
    setPage(1);
  }, []);
  const filters = useMemo(
    () => ({
      keyword: debouncedKeyword,
      sourceType,
      module,
      status,
      failedOnly,
      page,
      pageSize,
    }),
    [debouncedKeyword, sourceType, module, status, failedOnly, page, pageSize],
  );
  const listQuery = useQuery(knowledgeBaseQueryOptions(filters));
  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;
  const currentPage = pagination?.page ?? page;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  useEffect(() => {
    if (!pagination || items.length > 0 || pagination.total === 0 || page <= 1) {
      return;
    }
    setPage(Math.max(1, pagination.totalPages));
  }, [items.length, page, pagination]);

  useEffect(() => {
    if (!selectedKnowledge && items.length) {
      const first = items[0]!;
      setSelectedKnowledge({
        sourceType: first.sourceType,
        sourceId: first.sourceId,
      });
    }
  }, [items, selectedKnowledge]);

  const detailQuery = useQuery({
    ...knowledgeDetailQueryOptions(selectedKnowledge?.sourceType, selectedKnowledge?.sourceId),
    enabled: Boolean(selectedKnowledge),
  });
  const detail = detailQuery.data;
  const [draftChunks, setDraftChunks] = useState<KnowledgeChunk[]>([]);

  useEffect(() => {
    setDraftChunks(detail?.chunks ?? []);
  }, [detail?.sourceType, detail?.sourceId, detail?.updatedAt]);

  const invalidateKnowledgeQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    if (selectedKnowledge) {
      queryClient.invalidateQueries({
        queryKey: [
          "admin-knowledge-base-detail",
          selectedKnowledge.sourceType,
          selectedKnowledge.sourceId,
        ],
      });
    }
  }, [queryClient, selectedKnowledge]);

  const updateKnowledgeMutation = useMutation({
    mutationFn: async ({
      sourceType,
      sourceId,
      data,
    }: {
      sourceType: KnowledgeSourceType;
      sourceId: string;
      data: {
        chunks?: Array<{ id: string; content: string }>;
      };
    }) => {
      const res = await apiClient.kb.admin.items[":sourceType"][":sourceId"].$patch({
        param: { sourceType, sourceId },
        json: data,
      }, {
        fetch: kbAdminSaveFetch,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "保存失败"));
      }
      return res.json();
    },
    onSuccess: invalidateKnowledgeQueries,
    onError: (error) => {
      toast({
        title: getErrorMessage(error, "保存失败"),
        variant: "destructive",
      });
    },
  });

  const updateKnowledgeChunkMutation = useMutation({
    mutationFn: async ({ id, isDeleted }: { id: string; isDeleted: boolean }) => {
      const res = await apiClient.kb.admin.chunks[":id"].$patch({
        param: { id },
        json: { isDeleted },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "更新片段状态失败"));
      }
      return res.json();
    },
    onSuccess: invalidateKnowledgeQueries,
    onError: (error) => {
      toast({ title: getErrorMessage(error, "更新片段状态失败"), variant: "destructive" });
    },
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async ({
      sourceType,
      sourceId,
    }: {
      sourceType: KnowledgeSourceType;
      sourceId: string;
    }) => {
      const res = await apiClient.kb.admin.items[":sourceType"][":sourceId"].$delete({
        param: { sourceType, sourceId },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "删除失败"));
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSelectedKnowledge(null);
      toast({ title: "已删除" });
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, "删除失败"),
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    invalidateKnowledgeQueries();
  };

  const handleSave = () => {
    if (!detail) return;
    const changedChunks = draftChunks.filter((chunk) => {
      const original = detail.chunks.find((item) => item.id === chunk.id);
      return original && original.content !== chunk.content;
    });
    if (changedChunks.length === 0) {
      toast({ title: "没有需要保存的改动" });
      return;
    }

    updateKnowledgeMutation.mutate(
      {
        sourceType: detail.sourceType,
        sourceId: detail.sourceId,
        data: {
          chunks: changedChunks.length
            ? changedChunks.map((chunk) => ({
                id: chunk.id,
                content: chunk.content,
              }))
            : undefined,
        },
      },
      { onSuccess: () => toast({ title: "已保存并重建索引" }) },
    );
  };

  const handleToggleChunkDisabled = (chunk: KnowledgeChunk) => {
    updateKnowledgeChunkMutation.mutate(
      { id: chunk.id, isDeleted: !chunk.isDeleted },
      { onSuccess: () => toast({ title: chunk.isDeleted ? "已解除禁用" : "已禁用" }) },
    );
  };

  const handleConfirmDelete = () => {
    if (!detail) return;
    deleteKnowledgeMutation.mutate({
      sourceType: detail.sourceType,
      sourceId: detail.sourceId,
    });
  };

  const summary = listQuery.data?.summary;
  const isFailureView = Boolean(failedOnly && detail?.syncFailed);
  const isMutating =
    updateKnowledgeMutation.isPending ||
    updateKnowledgeChunkMutation.isPending ||
    deleteKnowledgeMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border px-6 py-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">知识库</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              管理 AI 回答时可召回的知识内容，保存后自动重建索引
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
          <div className="grid grid-cols-4 divide-x divide-border">
            <KbStatCell
              label="可用知识"
              value={summary?.enabledCount ?? 0}
              onClick={resetStatusFilters}
            />
            <KbStatCell
              label="知识片段"
              value={summary?.chunkCount ?? 0}
              onClick={resetStatusFilters}
            />
            <button
              type="button"
              aria-pressed={status === "disabled"}
              onClick={() => {
                setStatus((value) => (value === "disabled" ? "all" : "disabled"));
                setFailedOnly(false);
                setPage(1);
                setSelectedKnowledge(null);
              }}
              className={cn(
                "px-4 py-2.5 text-left transition-colors",
                status === "disabled" ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                已禁用
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums leading-none">
                  {summary?.disabledCount ?? 0}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {status === "disabled" ? "筛选中" : "点击筛选"}
                </span>
              </div>
            </button>
          <button
            type="button"
            onClick={() => {
              setFailedOnly((value) => !value);
              setStatus("all");
              setPage(1);
              setSelectedKnowledge(null);
            }}
            className={cn(
              "px-4 py-2.5 text-left transition-colors",
              failedOnly ? "bg-destructive/10" : "hover:bg-accent/50",
            )}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              同步失败
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-xl font-semibold tabular-nums leading-none",
                  (summary?.failedSyncCount ?? 0) > 0 && "text-destructive",
                )}
              >
                {summary?.failedSyncCount ?? 0}
              </span>
              {(summary?.failedSyncCount ?? 0) === 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  正常
                </span>
              ) : (
                <span className="text-[11px] text-destructive">点击筛选</span>
              )}
            </div>
          </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative min-w-[260px] flex-1">
          <Input
            placeholder="搜索标题、内容、标签、知识 ID、工单 ID..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              resetListPage();
              setSelectedKnowledge(null);
            }}
            className="h-9 pl-9"
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Select
          value={sourceType}
          onValueChange={(value) => {
            setSourceType(value as KnowledgeListFilters["sourceType"]);
            resetListPage();
            setSelectedKnowledge(null);
          }}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="favorited_conversation">精选案例</SelectItem>
            <SelectItem value="historical_ticket">历史工单</SelectItem>
            <SelectItem value="general_knowledge">通用知识</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={module}
          onValueChange={(value) => {
            setModule(value);
            resetListPage();
            setSelectedKnowledge(null);
          }}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="模块">
              {module === "all" ? "全部模块" : module}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模块</SelectItem>
            {(listQuery.data?.filters.modules ?? []).filter((item) => item !== "all").map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as KnowledgeStatusFilter);
            setFailedOnly(false);
            resetListPage();
            setSelectedKnowledge(null);
          }}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="enabled">启用</SelectItem>
            <SelectItem value="disabled">禁用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isLoading ? (
        <KnowledgeBaseSkeleton />
      ) : listQuery.isError ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {getErrorMessage(listQuery.error, "知识库加载失败")}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Database className="h-10 w-10" />
          <div className="text-sm">
            {failedOnly ? "暂无同步失败内容" : "暂无知识内容"}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] border-r border-border">
            <div className="min-h-0 overflow-auto p-2.5">
              {items.map((item) => {
                const key = makeKnowledgeKey(item);
                const active = selectedKnowledge
                  ? key === makeKnowledgeKey(selectedKnowledge)
                  : false;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setSelectedKnowledge({
                        sourceType: item.sourceType,
                        sourceId: item.sourceId,
                      })
                    }
                    className={cn(
                      "mb-1 w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-border bg-accent text-accent-foreground"
                        : "border-transparent hover:bg-accent/60",
                    )}
                  >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        SOURCE_DOT[item.sourceType],
                      )}
                    />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {SOURCE_TYPE_LABELS[item.sourceType]}
                    </span>
                    {item.disabledChunkCount === item.chunkCount && item.chunkCount > 0 ? (
                      <span className="ml-auto rounded border border-destructive/30 bg-destructive/10 px-1.5 py-px text-[10px] text-destructive">
                        已禁用
                      </span>
                    ) : item.disabledChunkCount > 0 ? (
                      <span className="ml-auto rounded border border-amber-500/30 bg-amber-50 px-1.5 py-px text-[10px] text-amber-700">
                        有禁用
                      </span>
                    ) : item.syncFailed ? (
                      <span className="ml-auto text-[11px] text-destructive">同步失败</span>
                    ) : null}
                  </div>
                  <div className="line-clamp-2 mb-1.5 font-medium leading-snug">
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                    <span>{item.module || "未分模块"}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.chunkCount} 片段</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{item.accessCount} 命中</span>
                    <span className="ml-auto text-muted-foreground/70">
                      {formatRelativeFromNow(item.updatedAt)}
                    </span>
                  </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                共 {pagination?.total ?? 0} 条 · 第 {currentPage} / {totalPages} 页
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!canGoPrevious || listQuery.isFetching}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!canGoNext || listQuery.isFetching}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-5">
            {!selectedKnowledge ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                请选择一条知识
              </div>
            ) : detailQuery.isLoading ? (
              <KnowledgeDetailSkeleton />
            ) : detailQuery.isError ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">
                {getErrorMessage(detailQuery.error, "知识详情加载失败")}
              </div>
            ) : detail ? (
              <div className="space-y-5">
                {detail.syncFailed ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    同步失败。请查看导入失败的原始内容，确认后可打开工单处理或删除失败记录。
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      SOURCE_DOT[detail.sourceType],
                    )}
                  />
                  <span className="text-muted-foreground">
                    {detail.sourceType === "favorited_conversation"
                      ? "工单 ID"
                      : SOURCE_TYPE_LABELS[detail.sourceType]}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-mono text-muted-foreground">
                    {detail.sourceId}
                  </span>
                  {detail.ticketId ? (
                    <Button variant="ghost" size="sm" asChild className="ml-auto h-7">
                      <Link to="/staff/tickets/$id" params={{ id: detail.ticketId }}>
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        打开工单
                      </Link>
                    </Button>
                  ) : null}
                </div>

                <div className="text-2xl font-semibold tracking-tight">
                  {detail.title}
                </div>

                {isFailureView ? (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 border-y border-border py-3">
                    <KbDetailMeta label="模块" value={detail.module || "未分模块"} />
                    <KbDetailMeta
                      label="分类"
                      value={detail.category || "未分类"}
                      muted
                    />
                    <KbDetailMeta
                      label="导入范围"
                      value={
                        detail.selectionMode === "entire_conversation"
                          ? "整段对话"
                          : "选中消息"
                      }
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-x-6 gap-y-2 border-y border-border py-3">
                    <KbDetailMeta label="模块" value={detail.module || "未分模块"} />
                    <KbDetailMeta
                      label="分类"
                      value={detail.category || "未分类"}
                      muted
                    />
                    <KbDetailMeta label="片段" value={String(draftChunks.length)} />
                    <KbDetailMeta label="命中" value={String(detail.accessCount)} />
                  </div>
                )}

                {detail.tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      标签
                    </span>
                    {detail.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {isFailureView ? (
                  <KnowledgeSourceMessages messages={detail.sourceMessages} />
                ) : (
                  <div className="border-t border-border pt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-medium">内容片段</div>
                      <div className="text-xs text-muted-foreground">
                        未点击保存前不会写入数据库
                      </div>
                    </div>
                    <div className="space-y-4">
                      {draftChunks.map((chunk, index) => (
                        <div key={chunk.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            {chunk.chunkId === 0 ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-orange-500/30 bg-orange-50 text-orange-700"
                              >
                                <Sparkles className="h-3 w-3" />
                                AI 摘要
                              </Badge>
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">
                                原始内容 {index}
                              </span>
                            )}
                            {chunk.isDeleted ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/30 bg-destructive/10 text-destructive"
                              >
                                已禁用
                              </Badge>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="ml-auto h-7"
                              onClick={() => handleToggleChunkDisabled(chunk)}
                              disabled={isMutating}
                            >
                              {chunk.isDeleted ? "解除禁用" : "禁用"}
                            </Button>
                          </div>
                          <Textarea
                            value={chunk.content}
                            onChange={(e) =>
                              setDraftChunks((prev) =>
                                prev.map((item) =>
                                  item.id === chunk.id
                                    ? { ...item, content: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            className={cn(
                              "min-h-[130px] resize-y text-sm leading-6",
                              chunk.isDeleted && "border-destructive/30 bg-destructive/5",
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {isFailureView ? null : (
                    <Button onClick={handleSave} disabled={isMutating} className="shadow-sm">
                      <Save className="mr-2 h-4 w-4" />
                      保存并重建索引
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className={cn(
                      "text-destructive hover:text-destructive",
                      !isFailureView && "ml-auto",
                    )}
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isMutating}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isFailureView ? "删除失败记录" : "删除"}
                  </Button>
                </div>

                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>确认删除知识</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {isFailureView ? (
                        <>
                          <p>删除后会移除这条同步失败记录。</p>
                          <p>如果这条记录没有成功生成过知识内容，不会影响现有可用知识。</p>
                        </>
                      ) : (
                        <>
                          <p>删除后会移除这条知识的全部片段。</p>
                          <p>相关命中记录会被级联删除，历史命中分析数据会减少。</p>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirmDelete}
                        disabled={deleteKnowledgeMutation.isPending}
                      >
                        确定删除
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function KbStatCell({
  label,
  value,
  muted,
  onClick,
}: {
  label: string;
  value: number;
  muted?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums leading-none",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="px-4 py-2.5">
      {content}
    </div>
  );
}

function KbDetailMeta({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm font-medium",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function KnowledgeSourceMessages({
  messages,
}: {
  messages: KnowledgeSourceMessage[];
}) {
  return (
    <div className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">导入失败的内容</div>
        <div className="text-xs text-muted-foreground">
          原始消息全文
        </div>
      </div>
      {messages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          未找到原始消息内容
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {message.senderName}
                </span>
                <span>{message.senderRoleLabel}</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{formatDateTime(message.createdAt)}</span>
                {message.isInternal ? (
                  <Badge variant="outline">内部</Badge>
                ) : null}
                {message.withdrawn ? (
                  <Badge variant="outline">已撤回</Badge>
                ) : null}
              </div>
              <div className="whitespace-pre-wrap break-words text-sm leading-6">
                {message.contentText || "（空消息）"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeBaseSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-2 border-r border-border p-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <div className="space-y-4 p-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function KnowledgeDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}

function AiRolesEmptyState() {
  const { openSettingsModal, settingsModal } = useSettingsModal();

  const handleOpenUserManagement = () => {
    openSettingsModal("userManagement");
  };

  return (
    <>
      <div className="h-full w-full flex items-center justify-center">
        <div
          className="flex w-full h-full flex-col items-center justify-center rounded-2xl text-center cursor-pointer group -mt-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          role="button"
          tabIndex={0}
          aria-label="前往用户管理，设置AI角色"
          onClick={handleOpenUserManagement}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenUserManagement();
            }
          }}
        >
          <EmptyStateIcon className="w-24 h-24 [&_*]:transition-colors [&_*]:fill-zinc-400 group-hover:[&_[data-hover-fill]]:fill-zinc-700" />
          <div className="space-y-3 mt-4">
            <h3 className="text-2xl font-semibold text-foreground">
              暂无AI角色
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              还没有配置任何AI角色。点击前往用户管理，将用户设置为AI角色。
            </p>
          </div>
        </div>
      </div>
      {settingsModal}
    </>
  );
}
