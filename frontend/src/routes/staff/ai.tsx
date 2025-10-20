import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import {
  Search,
  Plus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Trash2,
  Camera,
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
  const [tab, setTab] = useState<"ai" | "workflow">("ai");

  useEffect(() => {
    if (searchTab === "workflow" || searchTab === "ai") {
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
            onTabChange={(tabKey) => setTab(tabKey as "ai" | "workflow")}
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
