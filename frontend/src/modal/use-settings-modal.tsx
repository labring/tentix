import { userInfoQueryOptions, useSuspenseQuery } from "@lib/query";
import {
  useMutation,
  useQueryClient,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useBoolean } from "ahooks";
import { useTranslation } from "i18n";
import { useState, useRef } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  Separator,
  toast,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ScrollArea,
} from "tentix-ui";
import {
  Camera,
  Link,
  Unlink,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@lib/api-client";
import { uploadAvatar, updateUserAvatar } from "@utils/avatar-manager";
import { userRoleEnumArray } from "tentix-server/constants";
import useDebounce from "@hook/use-debounce";

// ----- Types & Constants -----
type UserRole = (typeof userRoleEnumArray)[number];
type AssignableUserRole = Exclude<UserRole, "system">;

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function useSettingsModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [activeSection, setActiveSection] = useState<
    "userInfo" | "accountBinding" | "userManagement"
  >("userInfo");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // User management states
  const [userManagementPage, setUserManagementPage] = useState(1);
  const [userManagementSearch, setUserManagementSearch] = useState("");
  const debouncedUserManagementSearch = useDebounce(userManagementSearch, 400);
  type UserManagementRoleFilter = "all" | AssignableUserRole;
  const [userManagementRole, setUserManagementRole] =
    useState<UserManagementRoleFilter>("all");
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  // Get user info from API
  const { data: userInfo } = useSuspenseQuery(userInfoQueryOptions());

  // Get user identities (for account binding) - only for non-customer roles
  const { data: identitiesData } = useQuery({
    queryKey: ["getUserIdentities"],
    queryFn: async () => {
      if (userInfo.role === "customer") return { identities: [] };
      const res = await apiClient.user.identities.$get();
      if (!res.ok) throw new Error("Failed to fetch identities");
      return await res.json();
    },
    enabled: userInfo.role !== "customer",
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Setup mutation for updating avatar
  const updateAvatarMutation = useMutation({
    mutationFn: ({
      avatar,
      oldAvatar,
    }: {
      avatar: string;
      oldAvatar?: string;
    }) => updateUserAvatar(avatar, oldAvatar),
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("avatar_updated"),
        variant: "default",
      });
      // Invalidate user info query to refresh data
      queryClient.invalidateQueries({
        queryKey: ["getUserInfo"],
      });
      setIsUploading(false);
    },
    onError: (_error: Error) => {
      toast({
        title: t("error"),
        description: t("failed_update_avatar"),
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  // Setup mutation for unbinding Feishu
  const unbindFeishuMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.user["unbind-feishu"].$delete();
      if (!res.ok) throw new Error("Failed to unbind Feishu account");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("feishu_unbound"),
        variant: "default",
      });
      // Invalidate identities query to refresh data
      queryClient.invalidateQueries({
        queryKey: ["getUserIdentities"],
      });
    },
    onError: (_error: Error) => {
      toast({
        title: t("error"),
        description: t("failed_unbind_feishu"),
        variant: "destructive",
      });
    },
  });

  // Setup mutation for getting Feishu bind URL
  const getFeishuBindUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.feishu["bind-url"].$get();
      if (!res.ok) throw new Error("Failed to get Feishu bind URL");
      return await res.json();
    },
    onSuccess: (data) => {
      // Always try to redirect parent window first (for iframe support)
      try {
        if (window.self !== window.top) {
          // In iframe - redirect parent window
          window.parent.location.href = data.bindUrl;
        } else {
          // Not in iframe - redirect current window
          window.location.href = data.bindUrl;
        }
      } catch (_e) {
        // Fallback to current window if parent access is denied
        window.location.href = data.bindUrl;
      }
    },
    onError: (_error: Error) => {
      toast({
        title: t("error"),
        description: t("failed_start_feishu_binding"),
        variant: "destructive",
      });
    },
  });

  // User management query
  const usersQueryOptions = queryOptions({
    queryKey: [
      "admin-users",
      userManagementPage,
      debouncedUserManagementSearch,
      userManagementRole,
    ],
    queryFn: async () => {
      const roleQuery: Partial<{ role: AssignableUserRole }> =
        userManagementRole && userManagementRole !== "all"
          ? { role: userManagementRole }
          : {};
      const res = await apiClient.admin.users.$get({
        query: {
          page: userManagementPage.toString(),
          limit: "10",
          ...(debouncedUserManagementSearch && {
            search: debouncedUserManagementSearch,
          }),
          ...roleQuery,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    },
    enabled: activeSection === "userManagement" && userInfo.role === "admin",
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: usersData } = useQuery(usersQueryOptions);

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({
      id,
      role,
    }: {
      id: number;
      role: AssignableUserRole;
    }) => {
      const res = await apiClient.admin.users[":id"]["role"].$patch({
        param: { id: id.toString() },
        json: { role },
      });
      if (!res.ok) throw new Error("Failed to update user role");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "用户角色已更新",
        variant: "default",
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "错误",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: t("error"),
        description: t("please_select_image_file"),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast({
        title: t("error"),
        description: t("image_size_limit"),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadedUrl = await uploadAvatar(file, userInfo.id);
      await updateAvatarMutation.mutateAsync({
        avatar: uploadedUrl,
        oldAvatar: userInfo.avatar,
      });
    } catch (error) {
      console.error("Avatar upload failed:", error);
      toast({
        title: t("error"),
        description: t("failed_upload_avatar"),
        variant: "destructive",
      });
      setIsUploading(false);
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Format register time
  const formatRegisterTime = (timeStr: string) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      return date.toLocaleDateString();
    } catch {
      return timeStr;
    }
  };

  // Function to open the settings modal
  function openSettingsModal(
    section?: "userInfo" | "accountBinding" | "userManagement",
  ) {
    setTrue();
    setActiveSection(section || "userInfo");
  }

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[620px] md:max-w-[880px] lg:max-w-[980px] !rounded-2xl border-0">
        {/* 主体区域，参照示例为左侧窄栏 + 右侧内容 */}
        <div className="flex h-[560px]">
          {/* 左侧侧边栏 */}
          <div className="hidden md:flex w-[260px] shrink-0 border-r bg-zinc-50/70">
            <div className="w-full p-4">
              <div className="space-y-2">
                <Button
                  variant={activeSection === "userInfo" ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-10 px-3 text-sm rounded-xl",
                    activeSection === "userInfo"
                      ? "bg-white shadow-sm"
                      : "hover:bg-zinc-100",
                  )}
                  onClick={() => setActiveSection("userInfo")}
                >
                  {t("user_info")}
                </Button>
                {userInfo.role !== "customer" && (
                  <Button
                    variant={
                      activeSection === "accountBinding" ? "secondary" : "ghost"
                    }
                    className={cn(
                      "w-full justify-start h-10 px-3 text-sm rounded-xl",
                      activeSection === "accountBinding"
                        ? "bg-white shadow-sm"
                        : "hover:bg-zinc-100",
                    )}
                    onClick={() => setActiveSection("accountBinding")}
                  >
                    {t("account_binding")}
                  </Button>
                )}
                {userInfo.role === "admin" && (
                  <Button
                    variant={
                      activeSection === "userManagement" ? "secondary" : "ghost"
                    }
                    className={cn(
                      "w-full justify-start h-10 px-3 text-sm rounded-xl",
                      activeSection === "userManagement"
                        ? "bg-white shadow-sm"
                        : "hover:bg-zinc-100",
                    )}
                    onClick={() => setActiveSection("userManagement")}
                  >
                    <span className="truncate">用户管理</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 右侧内容区，包含顶部面包屑式标题 */}
          <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center px-5">
              <div className="text-sm text-zinc-500">
                <span className="hidden md:inline">{t("settings")}</span>
                <span className="hidden md:inline mx-2">/</span>
                <span className="text-zinc-900 font-medium">
                  {activeSection === "userInfo" && t("user_info")}
                  {activeSection === "accountBinding" &&
                    t("account_binding_manage")}
                  {activeSection === "userManagement" && "用户管理"}
                </span>
              </div>
            </header>
            <ScrollArea className="flex-1 overflow-y-auto p-5 pt-0">
              {activeSection === "userInfo" && (
                <div className="space-y-6 max-w-3xl">
                  <div>
                    {/* Avatar section */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative">
                        <Avatar className="w-16 h-16">
                          <AvatarImage
                            src={userInfo.avatar || "/placeholder.svg"}
                            alt={userInfo.name || "User"}
                          />
                          <AvatarFallback className="text-lg">
                            {userInfo.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full p-0 bg-white border shadow-sm"
                          onClick={triggerFileInput}
                          disabled={isUploading}
                        >
                          <Camera className="w-4 h-4" />
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 mb-1">
                          {t("change_avatar")}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {t("avatar_upload_tip")}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* User info display */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-medium text-zinc-700 block mb-2">
                            {t("username")}
                          </label>
                          <div className="p-3 bg-zinc-50 rounded-lg border">
                            <p className="text-sm text-zinc-900">
                              {userInfo.name || "-"}
                            </p>
                          </div>
                        </div>

                        {userInfo.sealosId && (
                          <div>
                            <label className="text-sm font-medium text-zinc-700 block mb-2">
                              {t("sealos_id")}
                            </label>
                            <div className="p-3 bg-zinc-50 rounded-lg border">
                              <p className="text-sm text-zinc-900">
                                {userInfo.sealosId}
                              </p>
                            </div>
                          </div>
                        )}

                        {userInfo.realName && (
                          <div>
                            <label className="text-sm font-medium text-zinc-700 block mb-2">
                              {t("real_name")}
                            </label>
                            <div className="p-3 bg-zinc-50 rounded-lg border">
                              <p className="text-sm text-zinc-900">
                                {userInfo.realName}
                              </p>
                            </div>
                          </div>
                        )}

                        {userInfo.email && (
                          <div>
                            <label className="text-sm font-medium text-zinc-700 block mb-2">
                              {t("email")}
                            </label>
                            <div className="p-3 bg-zinc-50 rounded-lg border">
                              <p className="text-sm text-zinc-900">
                                {userInfo.email}
                              </p>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium text-zinc-700 block mb-2">
                            {t("role")}
                          </label>
                          <div className="p-3 bg-zinc-50 rounded-lg border">
                            <p className="text-sm text-zinc-900">
                              {t(userInfo.role)}
                            </p>
                          </div>
                        </div>

                        {userInfo.registerTime && (
                          <div>
                            <label className="text-sm font-medium text-zinc-700 block mb-2">
                              {t("register_time")}
                            </label>
                            <div className="p-3 bg-zinc-50 rounded-lg border">
                              <p className="text-sm text-zinc-900">
                                {formatRegisterTime(userInfo.registerTime)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "accountBinding" &&
                userInfo.role !== "customer" && (
                  <div className="space-y-6 max-w-3xl">
                    <div>
                      <p className="text-sm text-zinc-600 mb-6">
                        {t("feishu_bind_hint_desc")}
                      </p>

                      {/* Feishu Binding Section */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                              <img
                                src="/icon/feishu.svg"
                                alt="Feishu"
                                className="w-10 h-10"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-zinc-900">
                                {t("feishu_account")}
                              </h4>
                              <p className="text-sm text-zinc-500">
                                {(() => {
                                  const feishuIdentity =
                                    identitiesData?.identities?.find(
                                      (identity) =>
                                        identity.provider === "feishu",
                                    );
                                  if (feishuIdentity) {
                                    const metadata =
                                      feishuIdentity.metadata as {
                                        feishu?: { unionId?: string };
                                      };
                                    return `${t("bound")} (${metadata?.feishu?.unionId || feishuIdentity.providerUserId})`;
                                  }
                                  return t("unbound");
                                })()}
                              </p>
                            </div>
                          </div>
                          <div>
                            {(() => {
                              const feishuIdentity =
                                identitiesData?.identities?.find(
                                  (identity) => identity.provider === "feishu",
                                );
                              if (feishuIdentity) {
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      unbindFeishuMutation.mutate()
                                    }
                                    disabled={unbindFeishuMutation.isPending}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Unlink className="w-4 h-4 mr-2" />
                                    {unbindFeishuMutation.isPending
                                      ? t("unbinding")
                                      : t("unbind")}
                                  </Button>
                                );
                              } else {
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      getFeishuBindUrlMutation.mutate()
                                    }
                                    disabled={
                                      getFeishuBindUrlMutation.isPending
                                    }
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Link className="w-4 h-4 mr-2" />
                                    {getFeishuBindUrlMutation.isPending
                                      ? t("binding_link_loading")
                                      : t("bind")}
                                  </Button>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-500 mt-4">
                        <p>• {t("feishu_bind_tip_fast_login")}</p>
                        <p>• {t("feishu_bind_tip_one_to_one")}</p>
                      </div>
                    </div>
                  </div>
                )}

              {activeSection === "userManagement" &&
                userInfo.role === "admin" && (
                  <div className="space-y-6 max-w-5xl">
                    <div>
                      {/* Filters */}
                      <div className="flex gap-4 mb-6">
                        <div className="relative flex-1 max-w-sm">
                          <Input
                            placeholder="搜索用户（姓名、ID、真实姓名）"
                            value={userManagementSearch}
                            onChange={(e) =>
                              setUserManagementSearch(e.target.value)
                            }
                            className="pl-9"
                          />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Select
                          value={userManagementRole}
                          onValueChange={(v) =>
                            setUserManagementRole(v as UserManagementRoleFilter)
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="按角色筛选" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部角色</SelectItem>
                            <SelectItem value="customer">客户</SelectItem>
                            <SelectItem value="agent">客服</SelectItem>
                            <SelectItem value="technician">技术员</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                            <SelectItem value="ai">AI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Users Table */}
                      {usersData ? (
                        <div className="space-y-4">
                          <div className="border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead>用户名</TableHead>
                                  <TableHead>角色</TableHead>
                                  <TableHead>注册时间</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {usersData.users.map((user) => (
                                  <>
                                    <TableRow key={user.id}>
                                      <TableCell
                                        onClick={() =>
                                          setExpandedUserId(
                                            expandedUserId === user.id
                                              ? null
                                              : user.id,
                                          )
                                        }
                                        className="cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Avatar className="w-6 h-6">
                                            <AvatarImage
                                              src={
                                                user.avatar ||
                                                "/placeholder.svg"
                                              }
                                            />
                                            <AvatarFallback className="text-xs">
                                              {user.name?.charAt(0) || "U"}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="font-medium">
                                            {user.name}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={user.role}
                                          onValueChange={(newRole) => {
                                            const allowedRoles: AssignableUserRole[] =
                                              [
                                                "customer",
                                                "agent",
                                                "technician",
                                                "admin",
                                                "ai",
                                              ];
                                            if (
                                              allowedRoles.includes(
                                                newRole as AssignableUserRole,
                                              )
                                            ) {
                                              updateUserRoleMutation.mutate({
                                                id: user.id,
                                                role: newRole as AssignableUserRole,
                                              });
                                            }
                                          }}
                                          disabled={
                                            updateUserRoleMutation.isPending ||
                                            user.role === "system"
                                          }
                                        >
                                          <SelectTrigger className="w-28 h-8">
                                            <SelectValue>
                                              <span className="text-xs">
                                                {user.role === "customer" &&
                                                  "客户"}
                                                {user.role === "agent" &&
                                                  "客服"}
                                                {user.role === "technician" &&
                                                  "技术员"}
                                                {user.role === "admin" &&
                                                  "管理员"}
                                                {user.role === "ai" && "AI"}
                                              </span>
                                            </SelectValue>
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="customer">
                                              客户
                                            </SelectItem>
                                            <SelectItem value="agent">
                                              客服
                                            </SelectItem>
                                            <SelectItem value="technician">
                                              技术员
                                            </SelectItem>
                                            <SelectItem value="admin">
                                              管理员
                                            </SelectItem>
                                            <SelectItem value="ai">
                                              AI
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {formatRegisterTime(user.registerTime)}
                                      </TableCell>
                                    </TableRow>
                                    {expandedUserId === user.id && (
                                      <TableRow className="bg-zinc-50/50">
                                        <TableCell colSpan={3}>
                                          <div className="p-4 border-t">
                                            <div className="grid grid-cols-2 gap-4 text-sm text-zinc-700">
                                              <div>
                                                <span className="text-zinc-500 mr-2">
                                                  ID
                                                </span>
                                                <span className="font-mono">
                                                  {user.id}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-zinc-500 mr-2">
                                                  真实姓名
                                                </span>
                                                <span>
                                                  {user.realName || "-"}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-zinc-500 mr-2">
                                                  邮箱
                                                </span>
                                                <span className="font-mono">
                                                  {user.email || "-"}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-zinc-500 mr-2">
                                                  级别
                                                </span>
                                                <span> {user.level}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Pagination */}
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              显示 {(userManagementPage - 1) * 10 + 1} -{" "}
                              {Math.min(
                                userManagementPage * 10,
                                usersData.pagination.total,
                              )}{" "}
                              条，共 {usersData.pagination.total} 条
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setUserManagementPage(
                                    Math.max(1, userManagementPage - 1),
                                  )
                                }
                                disabled={userManagementPage <= 1}
                              >
                                <ChevronLeft className="w-4 h-4" />
                                上一页
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setUserManagementPage(userManagementPage + 1)
                                }
                                disabled={
                                  userManagementPage >=
                                  usersData.pagination.totalPages
                                }
                              >
                                下一页
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          加载中...
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openSettingsModal,
    closeSettingsModal: setFalse,
    settingsModal: modal,
    isUploading,
  };
}
