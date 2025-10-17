import { userInfoQueryOptions, useSuspenseQuery } from "@lib/query";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTranslation } from "i18n";
import { Button, toast } from "tentix-ui";
import { Link, Unlink } from "lucide-react";
import { apiClient } from "@lib/api-client";

type IdentitiesData = {
  identities: Array<{
    provider: string;
    providerUserId: string;
    metadata?: unknown;
  }>;
};

export function AccountBindingSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: userInfo } = useSuspenseQuery(userInfoQueryOptions());

  const { data: identitiesData } = useQuery<IdentitiesData>({
    queryKey: ["getUserIdentities"],
    queryFn: async () => {
      if (userInfo.role === "customer") return { identities: [] } as IdentitiesData;
      const res = await apiClient.user.identities.$get();
      if (!res.ok) throw new Error("Failed to fetch identities");
      return await res.json();
    },
    enabled: userInfo.role !== "customer",
    staleTime: 5 * 60 * 1000,
  });

  const unbindFeishuMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.user["unbind-feishu"].$delete();
      if (!res.ok) throw new Error("Failed to unbind Feishu account");
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: t("success"), description: t("feishu_unbound"), variant: "default" });
      queryClient.invalidateQueries({ queryKey: ["getUserIdentities"] });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failed_unbind_feishu"), variant: "destructive" });
    },
  });

  const getFeishuBindUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.feishu["bind-url"].$get();
      if (!res.ok) throw new Error("Failed to get Feishu bind URL");
      return await res.json();
    },
    onSuccess: (data: { bindUrl: string }) => {
      try {
        if (window.self !== window.top) {
          window.parent.location.href = data.bindUrl;
        } else {
          window.location.href = data.bindUrl;
        }
      } catch {
        window.location.href = data.bindUrl;
      }
    },
    onError: () => {
      toast({ title: t("error"), description: t("failed_start_feishu_binding"), variant: "destructive" });
    },
  });

  const feishuIdentity = identitiesData?.identities?.find((i) => i.provider === "feishu");
  const unionId = (() => {
    if (!feishuIdentity) return undefined;
    const metadata = feishuIdentity.metadata as { feishu?: { unionId?: string } } | undefined;
    return metadata?.feishu?.unionId || feishuIdentity.providerUserId;
  })();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm text-zinc-600 mb-6">{t("feishu_bind_hint_desc")}</p>

        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <img src="/icon/feishu.svg" alt="Feishu" className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-medium text-zinc-900">{t("feishu_account")}</h4>
                <p className="text-sm text-zinc-500">
                  {feishuIdentity ? `${t("bound")} (${unionId})` : t("unbound")}
                </p>
              </div>
            </div>
            <div>
              {feishuIdentity ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unbindFeishuMutation.mutate()}
                  disabled={unbindFeishuMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  {unbindFeishuMutation.isPending ? t("unbinding") : t("unbind")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => getFeishuBindUrlMutation.mutate()}
                  disabled={getFeishuBindUrlMutation.isPending}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Link className="w-4 h-4 mr-2" />
                  {getFeishuBindUrlMutation.isPending ? t("binding_link_loading") : t("bind")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-500 mt-4">
          <p>• {t("feishu_bind_tip_fast_login")}</p>
          <p>• {t("feishu_bind_tip_one_to_one")}</p>
        </div>
      </div>
    </div>
  );
}


