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
  DialogHeader,
  DialogTitle,
  Separator,
  toast,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "tentix-ui";
import {
  Camera,
  Settings,
  Link,
  Unlink,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@lib/api-client";
import { uploadAvatar, updateUserAvatar } from "@utils/avatar-manager";

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
  const [userManagementRole, setUserManagementRole] = useState<string>("all");

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
      userManagementSearch,
      userManagementRole,
    ],
    queryFn: async () => {
      const res = await apiClient.admin.users.$get({
        query: {
          page: userManagementPage.toString(),
          limit: "10",
          ...(userManagementSearch && { search: userManagementSearch }),
          ...(userManagementRole && userManagementRole !== "all" && { role: userManagementRole }),
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
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
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
    if (file.size > 5 * 1024 * 1024) {
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
      <DialogContent className="flex flex-col gap-0 w-[64rem] max-w-[64rem] h-[36rem] !rounded-2xl p-0 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.10),0px_4px_6px_-2px_rgba(0,0,0,0.05)] border-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 px-6 py-4 border-b">
          <Settings className="w-5 h-5 text-zinc-600" />
          <DialogTitle className="text-lg font-semibold leading-none text-foreground font-sans">
            {t("settings")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <div className="w-64 border-r bg-zinc-50 p-4 rounded-bl-2xl">
            <div className="space-y-1">
              <Button
                variant={activeSection === "userInfo" ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-10 px-3",
                  activeSection === "userInfo" && "bg-white shadow-sm border",
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
                    "w-full justify-start h-10 px-3",
                    activeSection === "accountBinding" &&
                      "bg-white shadow-sm border",
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
                    "w-full justify-start h-10 px-3",
                    activeSection === "userManagement" &&
                      "bg-white shadow-sm border",
                  )}
                  onClick={() => setActiveSection("userManagement")}
                >
                  用户管理
                </Button>
              )}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 p-6 overflow-y-auto rounded-br-2xl">
            {activeSection === "userInfo" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                    {t("user_info")}
                  </h3>

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
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                      {t("account_binding_manage")}
                    </h3>
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
                                  const metadata = feishuIdentity.metadata as {
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
                                  onClick={() => unbindFeishuMutation.mutate()}
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
                                  disabled={getFeishuBindUrlMutation.isPending}
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
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                      用户管理
                    </h3>

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
                        onValueChange={setUserManagementRole}
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
                                <TableHead className="w-16">ID</TableHead>
                                <TableHead>用户名</TableHead>
                                <TableHead>真实姓名</TableHead>
                                <TableHead>邮箱</TableHead>
                                <TableHead>角色</TableHead>
                                <TableHead>注册时间</TableHead>
                                <TableHead className="w-24">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {usersData.users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-mono text-sm">
                                    {user.id}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Avatar className="w-6 h-6">
                                        <AvatarImage
                                          src={
                                            user.avatar || "/placeholder.svg"
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
                                  <TableCell>{user.realName || "-"}</TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {user.email || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={user.role}
                                      onValueChange={(newRole) =>
                                        updateUserRoleMutation.mutate({
                                          id: user.id,
                                          role: newRole,
                                        })
                                      }
                                      disabled={
                                        updateUserRoleMutation.isPending
                                      }
                                    >
                                      <SelectTrigger className="w-28 h-8">
                                        <SelectValue>
                                          <Badge
                                            variant={
                                              user.role === "admin"
                                                ? "destructive"
                                                : user.role === "ai"
                                                  ? "secondary"
                                                  : "outline"
                                            }
                                            className="text-xs"
                                          >
                                            {user.role === "customer" && "客户"}
                                            {user.role === "agent" && "客服"}
                                            {user.role === "technician" &&
                                              "技术员"}
                                            {user.role === "admin" && "管理员"}
                                            {user.role === "ai" && "AI"}
                                          </Badge>
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
                                        <SelectItem value="ai">AI</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {formatRegisterTime(user.registerTime)}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-muted-foreground">
                                      级别 {user.level}
                                    </span>
                                  </TableCell>
                                </TableRow>
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
