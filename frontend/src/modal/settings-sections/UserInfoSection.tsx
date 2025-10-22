import { userInfoQueryOptions, useSuspenseQuery } from "@lib/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "i18n";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
  toast,
} from "tentix-ui";
import { Camera } from "lucide-react";
import { uploadAvatar, updateUserAvatar } from "@utils/avatar-manager";

export type BasicUserInfo = {
  id: number;
  avatar?: string | null;
  name?: string | null;
  sealosId?: string | null;
  realName?: string | null;
  email?: string | null;
  role: string;
  registerTime?: string | null;
};

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function formatRegisterTime(timeStr?: string | null) {
  if (!timeStr) return "";
  try {
    const date = new Date(timeStr);
    return date.toLocaleDateString();
  } catch {
    return timeStr ?? "";
  }
}

export function UserInfoSection() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: userInfo } = useSuspenseQuery(userInfoQueryOptions());
  const [isUploading, setIsUploading] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["getUserInfo"] });
      setIsUploading(false);
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("failed_update_avatar"),
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: t("error"),
        description: t("please_select_image_file"),
        variant: "destructive",
      });
      return;
    }

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
        oldAvatar: userInfo.avatar ?? undefined,
      });
    } catch {
      toast({
        title: t("error"),
        description: t("failed_upload_avatar"),
        variant: "destructive",
      });
      setIsUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Avatar className="w-16 h-16">
              <AvatarImage src={userInfo.avatar || "/placeholder.svg"} alt={userInfo.name || "User"} />
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
            <p className="text-xs text-zinc-500">{t("avatar_upload_tip")}</p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-zinc-700 block mb-2">{t("username")}</label>
              <div className="p-3 bg-zinc-50 rounded-lg border">
                <p className="text-sm text-zinc-900">{userInfo.name || "-"}</p>
              </div>
            </div>

            {userInfo.sealosId && (
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-2">{t("sealos_id")}</label>
                <div className="p-3 bg-zinc-50 rounded-lg border">
                  <p className="text-sm text-zinc-900">{userInfo.sealosId}</p>
                </div>
              </div>
            )}

            {userInfo.realName && (
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-2">{t("real_name")}</label>
                <div className="p-3 bg-zinc-50 rounded-lg border">
                  <p className="text-sm text-zinc-900">{userInfo.realName}</p>
                </div>
              </div>
            )}

            {userInfo.email && (
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-2">{t("email")}</label>
                <div className="p-3 bg-zinc-50 rounded-lg border">
                  <p className="text-sm text-zinc-900">{userInfo.email}</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-zinc-700 block mb-2">{t("role")}</label>
              <div className="p-3 bg-zinc-50 rounded-lg border">
                <p className="text-sm text-zinc-900">{t(userInfo.role)}</p>
              </div>
            </div>

            {userInfo.registerTime && (
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-2">{t("register_time")}</label>
                <div className="p-3 bg-zinc-50 rounded-lg border">
                  <p className="text-sm text-zinc-900">{formatRegisterTime(userInfo.registerTime)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


