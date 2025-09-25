import { userInfoQueryOptions, useSuspenseQuery } from "@lib/query";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
} from "tentix-ui";
import { Camera, Settings, Link, Unlink } from "lucide-react";
import { apiClient } from "@lib/api-client";
import { uploadAvatar, updateUserAvatar } from "@utils/avatar-manager";

export function useSettingsModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [activeSection, setActiveSection] = useState<
    "userInfo" | "accountBinding"
  >("userInfo");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
  function openSettingsModal() {
    setTrue();
    setActiveSection("userInfo");
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
