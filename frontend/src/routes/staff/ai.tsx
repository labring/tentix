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
import type { TFunction } from "i18next";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { apiClient, kbAdminSaveFetch, kbIndexGenerateFetch } from "@lib/api-client";
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
  FileUp,
} from "lucide-react";
import { uploadAvatar, deleteOldAvatar } from "@utils/avatar-manager";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { WorkflowBasicResponseType } from "tentix-server/rpc";
import { CommonCombobox } from "@comp/common/combobox";
import { FileImportDialog } from "@comp/staff/knowledge-base/file-import-dialog";
import {
  GENERAL_KNOWLEDGE_CATEGORY_VALUES,
  KnowledgeFieldsEditor,
  type GeneralKnowledgeCategory,
  type KnowledgeFieldErrors,
  type KnowledgeFieldValues,
} from "@comp/staff/knowledge-base/knowledge-fields-editor";
import { Tabs } from "@comp/common/tabs";
import useDebounce from "@hook/use-debounce";
import { useSettingsModal } from "@modal/use-settings-modal";
import { useTicketModules } from "@store/app-config";
import { cn } from "@lib/utils";

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err && "message" in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === "string" ? m : fallback;
  }
  return fallback;
}

const createWorkflowFormSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t("workflow_name_required")).trim(),
    description: z.string().trim(),
  });

type CreateWorkflowFormData = z.infer<
  ReturnType<typeof createWorkflowFormSchema>
>;

const MANUAL_GENERAL_KNOWLEDGE_SOURCE_DOC_ID = "manual";
const MANUAL_GENERAL_KNOWLEDGE_DOC_NAME = "手动添加";

const generalKnowledgeSourcePartSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .min(1, t("source_part_required"))
    .max(80, t("source_part_max", { count: 80 }))
    .regex(/^[A-Za-z0-9_-]+$/, t("source_part_pattern"));

function getManualGeneralKnowledgeRevision(): string {
  return `manual-${new Date().toISOString().slice(0, 10)}`;
}

function createManualGeneralKnowledgeEntrySlug(): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);

  return `manual-${Date.now().toString(36)}-${randomPart}`
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 80);
}

const createGeneralKnowledgeFormSchema = (t: TFunction) =>
  z.object({
    entrySlug: generalKnowledgeSourcePartSchema(t),
    title: z.string().trim().min(1, t("kb_title_required")).max(200),
    modules: z
      .array(z.string().trim().min(1))
      .min(1, t("kb_modules_required"))
      .max(10, t("kb_modules_max", { count: 10 })),
    category: z.enum(GENERAL_KNOWLEDGE_CATEGORY_VALUES),
    revision: z.string().trim().min(1, t("kb_revision_required")).max(80),
    content: z.string().trim().min(1, t("kb_content_required")).max(20000),
    index1: z.string().trim().max(500, t("kb_index_length_max", { count: 500 })).optional(),
    index2: z.string().trim().max(500, t("kb_index_length_max", { count: 500 })).optional(),
    index3: z.string().trim().max(500, t("kb_index_length_max", { count: 500 })).optional(),
  });

type CreateGeneralKnowledgeFormData = z.infer<
  ReturnType<typeof createGeneralKnowledgeFormSchema>
>;

type GeneralKnowledgeCreatePayload = {
  sourceId: string;
  title: string;
  modules: string[];
  category: GeneralKnowledgeCategory;
  docName?: string;
  revision: string;
  content: string;
  indexes?: string[];
};

type GeneralKnowledgeIndexesResponse = {
  success: boolean;
  data: { indexes: string[] };
};

function getDefaultGeneralKnowledgeFormValues(): CreateGeneralKnowledgeFormData {
  return {
    entrySlug: createManualGeneralKnowledgeEntrySlug(),
    title: "",
    modules: [],
    category: "troubleshooting",
    revision: getManualGeneralKnowledgeRevision(),
    content: "",
    index1: "",
    index2: "",
    index3: "",
  };
}

function buildGeneralKnowledgeSourceId(
  values: Pick<CreateGeneralKnowledgeFormData, "entrySlug">,
): string {
  return `general_knowledge:${MANUAL_GENERAL_KNOWLEDGE_SOURCE_DOC_ID}:${values.entrySlug.trim()}`;
}

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
  modules?: string[];
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
  modules?: string[];
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

function getSourceTypeLabel(
  sourceType: KnowledgeSourceType,
  t: TFunction,
): string {
  const labels: Record<KnowledgeSourceType, string> = {
    favorited_conversation: t("kb_featured_cases"),
    historical_ticket: t("kb_historical_tickets"),
    general_knowledge: t("kb_all_knowledge"),
  };
  return labels[sourceType];
}

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

async function createGeneralKnowledgePayload(
  data: GeneralKnowledgeCreatePayload,
  t: TFunction,
): Promise<{ success: boolean; data: { sourceType: "general_knowledge"; sourceId: string; chunkCount: number } }> {
  const res = await apiClient.kb.admin["general-knowledge"].$post({
    json: {
      sourceId: data.sourceId,
      title: data.title.trim(),
      modules: data.modules,
      category: data.category,
      docName: data.docName?.trim() || undefined,
      revision: data.revision.trim(),
      content: data.content.trim(),
      indexes: data.indexes?.length ? data.indexes : undefined,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errorData, t("kb_general_add_failed")));
  }
  return (await res.json()) as {
    success: boolean;
    data: { sourceType: "general_knowledge"; sourceId: string; chunkCount: number };
  };
}

async function generateGeneralKnowledgeIndexes(
  data: CreateGeneralKnowledgeFormData,
  t: TFunction,
): Promise<string[]> {
  const res = await apiClient.kb.admin["general-knowledge"].indexes.generate.$post(
    {
      json: {
        title: data.title.trim(),
        modules: data.modules,
        category: data.category,
        content: data.content.trim(),
      },
    },
    { fetch: kbIndexGenerateFetch },
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(errorData, t("kb_index_generate_failed")));
  }
  const body = (await res.json()) as GeneralKnowledgeIndexesResponse;
  return body.data.indexes;
}

async function createGeneralKnowledge(
  data: CreateGeneralKnowledgeFormData,
  t: TFunction,
): Promise<{ success: boolean; data: { sourceType: "general_knowledge"; sourceId: string; chunkCount: number } }> {
  const indexes = [data.index1, data.index2, data.index3]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return createGeneralKnowledgePayload(
    {
      sourceId: buildGeneralKnowledgeSourceId(data),
      title: data.title,
      modules: data.modules,
      category: data.category,
      docName: MANUAL_GENERAL_KNOWLEDGE_DOC_NAME,
      revision: data.revision,
      content: data.content,
      indexes,
    },
    t,
  );
}

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
function formatRelativeFromNow(
  iso: string | undefined,
  t: TFunction,
): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  const now = Date.now();
  let diff = Math.floor((now - ts) / 1000);
  if (!isFinite(diff)) return "";
  if (diff < 0) diff = 0;
  if (diff < 45) return t("relative_just_now");
  if (diff < 90) return t("relative_minutes", { count: 1 });
  const m = Math.floor(diff / 60);
  if (m < 60) return t("relative_minutes", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("relative_hours", { count: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t("relative_days", { count: d });
  const mo = Math.floor(d / 30);
  if (mo < 12) return t("relative_months", { count: mo });
  const y = Math.floor(mo / 12);
  return t("relative_years", { count: y });
}

export const Route = createFileRoute("/staff/ai")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || undefined,
  }),
  component: RouteComponent,
});

export function RouteComponent() {
  const { t } = useTranslation();
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
        label: t("ai_tab_roles"),
        content: (
          <Suspense fallback={<AiRolesSkeleton />}>
            <AiRolesTab />
          </Suspense>
        ),
      },
      {
        key: "workflow",
        label: t("ai_tab_workflows"),
        content: <WorkflowsTab />,
      },
      {
        key: "knowledge",
        label: t("ai_tab_knowledge"),
        content: <KnowledgeBaseTab />,
      },
    ],
    [t],
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
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder={t("ai_role_search")}
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
  const { t, i18n } = useTranslation();
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
        throw new Error(getErrorMessage(errorData, t("workflow_update_failed")));
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
        title: getErrorMessage(error, t("workflow_update_failed")),
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
        throw new Error(getErrorMessage(errorData, t("workflow_update_failed")));
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
        title: getErrorMessage(error, t("workflow_update_failed")),
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
      toast({ title: t("ai_select_image"), variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t("ai_image_size_limit"), variant: "destructive" });
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
      toast({ title: t("ai_avatar_updated") });
    } catch (e) {
      toast({
        title: getErrorMessage(e, t("ai_avatar_update_failed")),
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
      toast({ title: t("ai_name_updated") });
    } catch (e) {
      toast({
        title: getErrorMessage(e, t("ai_name_update_failed")),
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
                    placeholder={t("ai_name_placeholder")}
                    className="h-10 bg-transparent px-0 rounded-none border-0 border-b border-border/70 focus:border-foreground/80 focus-visible:ring-0 focus:ring-0 focus:outline-none shadow-none"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2 pb-5">
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="w-16 shrink-0 text-right text-[13px] text-muted-foreground">{t("ai_answer_scope")}</div>
                  <div className="flex-1 max-w-[260px]">
                    <CommonCombobox<{ id: string; name: string; code: string }>
                      options={[
                        {
                          id: "default_all",
                          name: t("ai_all_scope"),
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
                          { onSuccess: () => toast({ title: t("ai_scope_updated") }) },
                        )
                      }
                      disabled={updateAiRoleConfigMutation.isPending}
                      placeholder={t("ai_select_scope")}
                      searchPlaceholder={t("ai_search_scope")}
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
                  <div className="w-16 shrink-0 text-right text-[13px] text-muted-foreground">{t("ai_workflow_label")}</div>
                  <div className="flex-1 max-w-[260px]">
                    <CommonCombobox<WorkflowBasicResponseType>
                      options={allWorkflows}
                      value={u.aiRoleConfig?.workflowId ?? null}
                      onChange={(workflowId) => {
                        updateAiRoleConfigMutation.mutate(
                          { id: u.id, data: { workflowId } },
                          {
                            onSuccess: () => {
                              toast({ title: t("workflow_updated") });
                            },
                          },
                        );
                      }}
                      disabled={updateAiRoleConfigMutation.isPending}
                      placeholder={t("ai_select_workflow")}
                      searchPlaceholder={t("ai_search_workflow")}
                      noneLabel={t("ai_no_workflow")}
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
                    <span>{t("ai_created_at", { time: formatDateTime(u.aiRoleConfig.createdAt) })}</span>
                  ) : null}
                  {u.aiRoleConfig?.createdAt && u.aiRoleConfig?.updatedAt ? (
                    <span
                      aria-hidden
                      className="mx-4 h-[14px] w-px bg-border/60 inline-block"
                    />
                  ) : null}
                  {u.aiRoleConfig?.updatedAt ? (
                    <span>{t("ai_updated_at", { time: formatDateTime(u.aiRoleConfig.updatedAt) })}</span>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center">
                <div className="w-16 shrink-0 text-right text-[13px] text-muted-foreground">{t("ai_active_status")}</div>
                <div className="flex-1" />
                <Switch
                  checked={u.aiRoleConfig?.isActive ?? false}
                  disabled={updateAiRoleConfigMutation.isPending}
                  onCheckedChange={(checked) => {
                    updateAiRoleConfigMutation.mutate(
                      { id: u.id, data: { isActive: checked } },
                      {
                        onSuccess: () => {
                          toast({ title: t("ai_status_updated") });
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
  const { t } = useTranslation();

  const debouncedKeyword = useDebounce(keyword, 300);

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.admin.workflow[":id"].$delete({
        param: { id },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, t("workflow_delete_failed")));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("workflow_deleted") });
      queryClient.invalidateQueries({ queryKey: ["admin-workflows-basic"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-ai-role-configs-all"],
      });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, t("workflow_delete_failed")),
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
            placeholder={t("workflow_search")}
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
              <DialogTitle>{t("workflow_create_title")}</DialogTitle>
          </DialogHeader>
          <CreateWorkflowForm onCreated={handleCreateSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateWorkflowForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const schema = useMemo(() => createWorkflowFormSchema(t), [t]);
  const form = useForm<CreateWorkflowFormData>({
    resolver: zodResolver(schema),
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
        throw new Error(getErrorMessage(errorData, t("workflow_create_failed")));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("workflow_create_success") });
      form.reset();
      onCreated();
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, t("workflow_create_failed")),
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
              <FormLabel>{t("workflow_name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("workflow_name_placeholder")} {...field} />
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
              <FormLabel>{t("workflow_description")}</FormLabel>
              <FormControl>
                <Input placeholder={t("workflow_optional")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={createWorkflowMutation.isPending}>
            {createWorkflowMutation.isPending ? t("workflow_creating") : t("workflow_create_submit")}
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
  const { t } = useTranslation();
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
                {t("workflow_last_edited", { time: formatRelativeFromNow(wf.updatedAt, t) })}
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
                    {t("workflow_edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(wf.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("workflow_delete")}
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
  const { t } = useTranslation();
  const schema = useMemo(() => createGeneralKnowledgeFormSchema(t), [t]);
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [fileImportDialogOpen, setFileImportDialogOpen] = useState(false);
  const [autoGenerateIndexes, setAutoGenerateIndexes] = useState(false);
  const ticketModules = useTicketModules();
  const createKnowledgeForm = useForm<CreateGeneralKnowledgeFormData>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultGeneralKnowledgeFormValues(),
  });
  const manualKnowledgeValues = useWatch({ control: createKnowledgeForm.control });
  const knowledgeFieldValues: KnowledgeFieldValues = {
    title: manualKnowledgeValues.title ?? "",
    content: manualKnowledgeValues.content ?? "",
    modules: manualKnowledgeValues.modules ?? [],
    category: manualKnowledgeValues.category ?? "",
    revision: manualKnowledgeValues.revision ?? "",
    indexes: [
      manualKnowledgeValues.index1 ?? "",
      manualKnowledgeValues.index2 ?? "",
      manualKnowledgeValues.index3 ?? "",
    ],
  };
  const knowledgeFieldErrors: KnowledgeFieldErrors = {
    title: createKnowledgeForm.formState.errors.title?.message,
    modules: createKnowledgeForm.formState.errors.modules?.message,
    category: createKnowledgeForm.formState.errors.category?.message,
    revision: createKnowledgeForm.formState.errors.revision?.message,
    content: createKnowledgeForm.formState.errors.content?.message,
    indexes: [
      createKnowledgeForm.formState.errors.index1?.message,
      createKnowledgeForm.formState.errors.index2?.message,
      createKnowledgeForm.formState.errors.index3?.message,
    ],
  };
  const handleKnowledgeFieldChange = (value: KnowledgeFieldValues) => {
    createKnowledgeForm.setValue("title", value.title, {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("content", value.content, {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("modules", value.modules, {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("category", value.category as GeneralKnowledgeCategory, {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("revision", value.revision, {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("index1", value.indexes[0] ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("index2", value.indexes[1] ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    createKnowledgeForm.setValue("index3", value.indexes[2] ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const moduleOptions = useMemo(
    () =>
      ticketModules.map((item) => ({
        code: item.code,
        label: item.translations?.["zh-CN"] || item.code,
      })),
    [ticketModules],
  );
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
        throw new Error(getErrorMessage(errorData, t("kb_save_failed")));
      }
      return res.json();
    },
    onSuccess: invalidateKnowledgeQueries,
    onError: (error) => {
      toast({
        title: getErrorMessage(error, t("kb_save_failed")),
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
        throw new Error(getErrorMessage(errorData, t("kb_chunk_update_failed")));
      }
      return res.json();
    },
    onSuccess: invalidateKnowledgeQueries,
    onError: (error) => {
      toast({ title: getErrorMessage(error, t("kb_chunk_update_failed")), variant: "destructive" });
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
        throw new Error(getErrorMessage(errorData, t("kb_delete_failed")));
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSelectedKnowledge(null);
      toast({ title: t("kb_deleted") });
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, t("kb_delete_failed")),
        variant: "destructive",
      });
    },
  });

  const createGeneralKnowledgeMutation = useMutation({
    mutationFn: (data: CreateGeneralKnowledgeFormData) =>
      createGeneralKnowledge(data, t),
    onSuccess: (_result, values) => {
      const sourceId = buildGeneralKnowledgeSourceId(values);
      setCreateDialogOpen(false);
      createKnowledgeForm.reset(getDefaultGeneralKnowledgeFormValues());
      setSourceType("general_knowledge");
      setModule("all");
      setStatus("all");
      setFailedOnly(false);
      setKeyword("");
      setPage(1);
      setSelectedKnowledge({
        sourceType: "general_knowledge",
        sourceId,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
      queryClient.invalidateQueries({
        queryKey: [
          "admin-knowledge-base-detail",
          "general_knowledge",
          sourceId,
        ],
      });
      toast({ title: t("kb_general_added") });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, t("kb_general_add_failed")),
        variant: "destructive",
      });
    },
  });

  const generateGeneralKnowledgeIndexesMutation = useMutation({
    mutationFn: (data: CreateGeneralKnowledgeFormData) =>
      generateGeneralKnowledgeIndexes(data, t),
    onSuccess: (indexes) => {
      if (indexes.length === 0) {
        toast({ title: t("kb_no_valid_indexes") });
        return;
      }
      const fields = ["index1", "index2", "index3"] as const;
      let nextIndex = 0;
      let filledCount = 0;
      for (const field of fields) {
        if (nextIndex >= indexes.length) break;
        const current = createKnowledgeForm.getValues(field)?.trim();
        if (current) continue;
        createKnowledgeForm.setValue(field, indexes[nextIndex]!, {
          shouldDirty: true,
          shouldValidate: true,
        });
        nextIndex += 1;
        filledCount += 1;
      }
      if (filledCount === 0) {
        toast({ title: t("kb_index_exists") });
        return;
      }
      toast({ title: t("kb_index_generated") });
    },
    onError: (error) => {
      toast({
        title: getErrorMessage(error, t("kb_index_generate_failed")),
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    invalidateKnowledgeQueries();
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      createKnowledgeForm.reset(getDefaultGeneralKnowledgeFormValues());
      setAutoGenerateIndexes(false);
      generateGeneralKnowledgeIndexesMutation.reset();
    }
  };

  const handleCreateGeneralKnowledge = (values: CreateGeneralKnowledgeFormData) => {
    createGeneralKnowledgeMutation.mutate(values);
  };

  const handleGenerateGeneralKnowledgeIndexes = async () => {
    const valid = await createKnowledgeForm.trigger([
      "title",
      "modules",
      "category",
      "content",
    ]);
    if (!valid) {
      toast({
        title: t("kb_required_fields"),
        variant: "destructive",
      });
      return;
    }
    generateGeneralKnowledgeIndexesMutation.mutate(createKnowledgeForm.getValues());
  };

  const handleSave = () => {
    if (!detail) return;
    const changedChunks = draftChunks.filter((chunk) => {
      const original = detail.chunks.find((item) => item.id === chunk.id);
      return original && original.content !== chunk.content;
    });

    if (detail.sourceType === "general_knowledge") {
      const changedIndexChunks = changedChunks.filter((chunk) => chunk.chunkId > 0);
      const hasContentChunkChange = changedChunks.some((chunk) => chunk.chunkId === 0);
      if (hasContentChunkChange) {
        toast({
          title: t("kb_content_not_editable"),
          variant: "destructive",
        });
        return;
      }
      if (changedIndexChunks.length === 0) {
        toast({ title: t("kb_no_index_changes") });
        return;
      }
      const invalidIndexChunk = changedIndexChunks.find((chunk) => {
        const content = chunk.content.trim();
        return content.length === 0 || content.length > 500;
      });
      if (invalidIndexChunk) {
        toast({
          title: t("kb_index_too_long"),
          variant: "destructive",
        });
        return;
      }

      updateKnowledgeMutation.mutate(
        {
          sourceType: detail.sourceType,
          sourceId: detail.sourceId,
          data: {
            chunks: changedIndexChunks.map((chunk) => ({
              id: chunk.id,
              content: chunk.content,
            })),
          },
        },
        { onSuccess: () => toast({ title: t("kb_index_saved") }) },
      );
      return;
    }
    if (changedChunks.length === 0) {
      toast({ title: t("kb_no_changes") });
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
      { onSuccess: () => toast({ title: t("kb_saved_rebuilt") }) },
    );
  };

  const handleToggleChunkDisabled = (chunk: KnowledgeChunk) => {
    updateKnowledgeChunkMutation.mutate(
      { id: chunk.id, isDeleted: !chunk.isDeleted },
      { onSuccess: () => toast({ title: chunk.isDeleted ? t("kb_reenabled") : t("kb_disabled_status") }) },
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
  const isGeneralKnowledgeDetail = detail?.sourceType === "general_knowledge";
  const detailModuleText =
    isGeneralKnowledgeDetail && detail.modules?.length
      ? detail.modules.join(t("list_separator"))
      : detail?.module || t("kb_unmodularized");
  const isMutating =
    updateKnowledgeMutation.isPending ||
    updateKnowledgeChunkMutation.isPending ||
    deleteKnowledgeMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border px-6 py-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{t("knowledge_base_entry.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("knowledge_base_entry.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFileImportDialogOpen(true)}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {t("knowledge_base_entry.import_file")}
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("knowledge_base_entry.add_general")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("knowledge_base_entry.refresh")}
            </Button>
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
          <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] h-[min(860px,calc(100vh-2rem))] w-[min(1080px,calc(100vw-2rem))] sm:max-w-[1080px] overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle>{t("kb_add_general_title")}</DialogTitle>
            </DialogHeader>
            <Form {...createKnowledgeForm}>
              <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={createKnowledgeForm.handleSubmit(handleCreateGeneralKnowledge)}
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <KnowledgeFieldsEditor
                    value={knowledgeFieldValues}
                    moduleOptions={moduleOptions}
                    errors={knowledgeFieldErrors}
                    onChange={handleKnowledgeFieldChange}
                    showRevision
                    showIndexFields
                    showIndexGenerationControls
                    autoGenerateIndexes={autoGenerateIndexes}
                    onAutoGenerateIndexesChange={setAutoGenerateIndexes}
                    onGenerateIndexes={handleGenerateGeneralKnowledgeIndexes}
                    indexGenerationPending={
                      generateGeneralKnowledgeIndexesMutation.isPending
                    }
                    disabled={createGeneralKnowledgeMutation.isPending}
                  />
                </div>
                <DialogFooter className="border-t border-border bg-background px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCreateDialogOpenChange(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createGeneralKnowledgeMutation.isPending ||
                      generateGeneralKnowledgeIndexesMutation.isPending
                    }
                  >
                    {createGeneralKnowledgeMutation.isPending ? t("kb_adding") : t("kb_add_general")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <FileImportDialog
          open={fileImportDialogOpen}
          onOpenChange={setFileImportDialogOpen}
          moduleOptions={moduleOptions}
          onImported={handleRefresh}
        />

        <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
          <div className="grid grid-cols-4 divide-x divide-border">
            <KbStatCell
              label={t("kb_available")}
              value={summary?.enabledCount ?? 0}
              onClick={resetStatusFilters}
            />
            <KbStatCell
              label={t("kb_chunks")}
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
                {t("kb_disabled_status")}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums leading-none">
                  {summary?.disabledCount ?? 0}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {status === "disabled" ? t("kb_filtering") : t("kb_click_filter")}
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
              {t("kb_sync_failed")}
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
                  {t("kb_normal")}
                </span>
              ) : (
                <span className="text-[11px] text-destructive">{t("kb_click_filter")}</span>
              )}
            </div>
          </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative min-w-[260px] flex-1">
          <Input
            placeholder={t("kb_search_placeholder")}
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
            <SelectValue placeholder={t("kb_source")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kb_all_sources")}</SelectItem>
            <SelectItem value="favorited_conversation">{t("kb_featured_cases")}</SelectItem>
            <SelectItem value="historical_ticket">{t("kb_historical_tickets")}</SelectItem>
            <SelectItem value="general_knowledge">{t("kb_all_knowledge")}</SelectItem>
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
            <SelectValue placeholder={t("module")}>
              {module === "all" ? t("kb_all_modules") : module}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kb_all_modules")}</SelectItem>
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
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kb_all_statuses")}</SelectItem>
            <SelectItem value="enabled">{t("kb_enabled_status")}</SelectItem>
            <SelectItem value="disabled">{t("kb_filter_disabled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isLoading ? (
        <KnowledgeBaseSkeleton />
      ) : listQuery.isError ? (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {getErrorMessage(listQuery.error, t("kb_loading_failed"))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Database className="h-10 w-10" />
          <div className="text-sm">
            {failedOnly ? t("kb_no_failed_content") : t("kb_no_knowledge")}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] border-r border-border">
            <div className="min-h-0 overflow-auto p-2.5">
              {items.map((item) => {
                const key = makeKnowledgeKey(item);
                const moduleText =
                  item.sourceType === "general_knowledge" &&
                  item.modules?.length
                    ? item.modules.join(t("list_separator"))
                    : item.module || t("kb_unmodularized");
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
                      {getSourceTypeLabel(item.sourceType, t)}
                    </span>
                    {item.disabledChunkCount === item.chunkCount && item.chunkCount > 0 ? (
                      <span className="ml-auto rounded border border-destructive/30 bg-destructive/10 px-1.5 py-px text-[10px] text-destructive">
                        {t("kb_disabled_status")}
                      </span>
                    ) : item.disabledChunkCount > 0 ? (
                      <span className="ml-auto rounded border border-amber-500/30 bg-amber-50 px-1.5 py-px text-[10px] text-amber-700">
                        {t("kb_has_disabled")}
                      </span>
                    ) : item.syncFailed ? (
                      <span className="ml-auto text-[11px] text-destructive">{t("kb_sync_failed")}</span>
                    ) : null}
                  </div>
                  <div className="line-clamp-2 mb-1.5 font-medium leading-snug">
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                    <span
                      className="min-w-0 flex-1 truncate"
                      title={moduleText}
                    >
                      {moduleText}
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{t("kb_chunk_count", { count: item.chunkCount })}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{t("kb_hit_count", { count: item.accessCount })}</span>
                    <span className="ml-auto text-muted-foreground/70">
                      {formatRelativeFromNow(item.updatedAt, t)}
                    </span>
                  </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                {t("kb_pagination", { total: pagination?.total ?? 0, current: currentPage, totalPages })}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!canGoPrevious || listQuery.isFetching}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  {t("previous_page")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!canGoNext || listQuery.isFetching}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  {t("next_page")}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-5">
            {!selectedKnowledge ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("kb_select_knowledge")}
              </div>
            ) : detailQuery.isLoading ? (
              <KnowledgeDetailSkeleton />
            ) : detailQuery.isError ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">
                {getErrorMessage(detailQuery.error, t("kb_detail_failed"))}
              </div>
            ) : detail ? (
              <div className="space-y-5">
                {detail.syncFailed ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t("kb_sync_failed_detail")}
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
                      ? t("kb_ticket_id")
                      : getSourceTypeLabel(detail.sourceType, t)}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="font-mono text-muted-foreground">
                    {detail.sourceId}
                  </span>
                  {detail.ticketId ? (
                    <Button variant="ghost" size="sm" asChild className="ml-auto h-7">
                      <Link to="/staff/tickets/$id" params={{ id: detail.ticketId }}>
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        {t("kb_open_ticket")}
                      </Link>
                    </Button>
                  ) : null}
                </div>

                <div className="text-2xl font-semibold tracking-tight">
                  {detail.title}
                </div>

                {isFailureView ? (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 border-y border-border py-3">
                    <KbDetailMeta label={t("module")} value={detailModuleText} />
                    <KbDetailMeta
                      label={t("category")}
                      value={detail.category || t("kb_uncategorized")}
                      muted
                    />
                    <KbDetailMeta
                      label={t("kb_import_scope")}
                      value={
                        detail.selectionMode === "entire_conversation"
                          ? t("kb_entire_conversation")
                          : t("kb_selected_messages")
                      }
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-x-6 gap-y-2 border-y border-border py-3">
                    <KbDetailMeta label={t("module")} value={detailModuleText} />
                    <KbDetailMeta
                      label={t("category")}
                      value={detail.category || t("kb_uncategorized")}
                      muted
                    />
                    <KbDetailMeta label={t("kb_chunks_label")} value={String(draftChunks.length)} />
                    <KbDetailMeta label={t("kb_hits_label")} value={String(detail.accessCount)} />
                  </div>
                )}

                {detail.tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("kb_tags")}
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
                      <div className="text-sm font-medium">{t("kb_content_chunks")}</div>
                      <div className="text-xs text-muted-foreground">
                        {isGeneralKnowledgeDetail
                          ? t("kb_recall_only_editable")
                          : t("kb_not_saved_to_db")}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {draftChunks.map((chunk, index) => (
                        <div key={chunk.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            {detail.sourceType === "general_knowledge" ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-50 text-emerald-700"
                              >
                                {chunk.chunkId === 0 ? t("kb_formal_knowledge") : t("kb_recall_index")}
                              </Badge>
                            ) : chunk.chunkId === 0 ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-orange-500/30 bg-orange-50 text-orange-700"
                              >
                                <Sparkles className="h-3 w-3" />
                                {t("kb_ai_summary")}
                              </Badge>
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">
                                {t("kb_original_content", { index })}
                              </span>
                            )}
                            {chunk.isDeleted ? (
                              <Badge
                                variant="outline"
                                className="border-destructive/30 bg-destructive/10 text-destructive"
                              >
                                {t("kb_disabled_status")}
                              </Badge>
                            ) : null}
                            {isGeneralKnowledgeDetail ? (
                              <div className="ml-auto" />
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="ml-auto h-7"
                                onClick={() => handleToggleChunkDisabled(chunk)}
                                disabled={isMutating}
                              >
                                {chunk.isDeleted ? t("kb_reenable") : t("kb_disable")}
                              </Button>
                            )}
                          </div>
                          <Textarea
                            value={chunk.content}
                            readOnly={isGeneralKnowledgeDetail && chunk.chunkId === 0}
                            maxLength={isGeneralKnowledgeDetail && chunk.chunkId > 0 ? 500 : undefined}
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
                              isGeneralKnowledgeDetail && chunk.chunkId === 0 && "bg-muted/40",
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {isFailureView || (isGeneralKnowledgeDetail && !draftChunks.some((chunk) => chunk.chunkId > 0)) ? null : (
                    <Button onClick={handleSave} disabled={isMutating} className="shadow-sm">
                      <Save className="mr-2 h-4 w-4" />
                      {t("kb_save_and_rebuild")}
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
                    {isFailureView ? t("kb_delete_failed_record") : t("delete")}
                  </Button>
                </div>

                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("kb_confirm_delete")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {isFailureView ? (
                        <>
                          <p>{t("kb_delete_failed_description")}</p>
                          <p>{t("kb_delete_no_knowledge")}</p>
                        </>
                      ) : (
                        <>
                          <p>{t("kb_delete_all_chunks")}</p>
                          <p>{t("kb_cascade_warning")}</p>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirmDelete}
                        disabled={deleteKnowledgeMutation.isPending}
                      >
                        {t("kb_confirm_delete_button")}
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
  const { t } = useTranslation();
  return (
    <div className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">{t("kb_failed_content")}</div>
        <div className="text-xs text-muted-foreground">
          {t("kb_original_message_full")}
        </div>
      </div>
      {messages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          {t("kb_no_original_message")}
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
                  <Badge variant="outline">{t("internal")}</Badge>
                ) : null}
                {message.withdrawn ? (
                  <Badge variant="outline">{t("message_recalled")}</Badge>
                ) : null}
              </div>
              <div className="whitespace-pre-wrap break-words text-sm leading-6">
                {message.contentText || t("kb_empty_message")}
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
  const { t } = useTranslation();
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
          aria-label={t("ai_manage_users")}
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
              {t("ai_no_roles")}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("ai_no_roles_description")}
            </p>
          </div>
        </div>
      </div>
      {settingsModal}
    </>
  );
}
