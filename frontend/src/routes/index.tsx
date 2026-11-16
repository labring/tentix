import {
  createFileRoute,
  useRouter,
  useRouteContext,
} from "@tanstack/react-router";
import { areaEnumArray } from "tentix-server/constants";
import {
  useAuth,
} from "../hooks/use-local-user";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  releaseSealosAuthGate,
  hasSealosDesktopSession,
  getTentixTargetPlatform,
  exchangeSealosSession,
  safeSealosReturnTo,
  useSealos,
  waitForSealosInit,
} from "../_provider/sealos";
import { useTranslation } from "i18n";

// beforeLoad: 检查 url 是否有 token 信息，如果有则走第三方登录
export const Route = createFileRoute("/")({
  component: AuthGuard,
});

function AuthGuard() {
  const { t } = useTranslation();
  const router = useRouter();
  const authContext = useAuth();
  const sealosContext = useSealos();
  const { sealosUser, sealosUserId, isSealos, isInitialized } = sealosContext;
  const routeContext = useRouteContext({ from: "/" });
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authenticationStarted = useRef(false);

  // 根据角色导航到对应页面
  const navigateByRole = useCallback(
    (role: string) => {
      const returnTo = hasSealosDesktopSession()
        ? safeSealosReturnTo(new URL(window.location.href).searchParams.get("returnTo"), role)
        : null;
      if (returnTo) {
        void router.navigate({ to: returnTo, replace: true });
        return;
      }
      const isStaff = ["admin", "technician", "agent"].includes(role);
      router.navigate({
        to: isStaff ? "/staff/tickets/list" : "/user/tickets/list",
        replace: true,
      });
    },
    [router],
  );

  // 处理第三方登录
  const handleThirdPartyLogin = useCallback(
    async (token: string) => {
      const apiClient = routeContext.apiClient;
      const res = await apiClient.auth["third-party"]
        .$post({
          query: { token },
        })
        .then((r) => r.json());

      // 保存认证信息
      window.localStorage.setItem("role", res.role);
      window.localStorage.setItem("id", res.id.toString());
      window.localStorage.setItem("token", res.token);

      // 获取并更新用户信息
      const userData = await apiClient.user.info.$get().then((r) => r.json());
      authContext.updateUser(userData);
      authContext.setIsAuthenticated(true);

      // 导航
      navigateByRole(res.role);
    },
    [routeContext.apiClient, authContext, navigateByRole],
  );

  // 桌面每次启动均以服务端验证后的身份进入。
  const handleSealosLogin = useCallback(async () => {
    if (!sealosUserId) throw new Error("Sealos user id is missing");
    const user = await exchangeSealosSession(sealosUserId, {
      name: sealosUser?.name ?? "", avatar: sealosUser?.avatar ?? "",
    });
    const sealosArea = window.localStorage.getItem("sealosArea");
    authContext.updateUser(user, sealosArea as (typeof areaEnumArray)[number], sealosUser?.nsid ?? "");
    authContext.setIsAuthenticated(true);
    navigateByRole(user.role);
  }, [sealosUserId, sealosUser, authContext, navigateByRole]);

  useEffect(() => {
    if (!isInitialized || authenticationStarted.current) return;
    authenticationStarted.current = true;
    const initializeAndAuthenticate = async () => {
      try {
        await waitForSealosInit();

        if (!isInitialized) {
          return;
        }

        // 1. 处理第三方登录（优先级最高）
        const url = new URL(window.location.href);
        const thirdPartyToken = url.searchParams.get("token");

        if (thirdPartyToken) {
          await handleThirdPartyLogin(thirdPartyToken);
          return;
        }

        if (isSealos) {
          await handleSealosLogin();
          return;
        }
        if (getTentixTargetPlatform() !== "generic") {
          throw new Error(sealosContext.error || "Sealos session unavailable");
        }

        // 3. 处理普通环境
        if (!authContext.isAuthenticated || !authContext.user) {
          router.navigate({ to: "/login", replace: true });
          return;
        }

        // 4. 已认证用户：导航
        navigateByRole(authContext.user.role);
      } catch (error) {
        console.error("Authentication error:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        authContext.clearTentixSessionOnly();
        if (getTentixTargetPlatform() === "generic" && !hasSealosDesktopSession()) {
          releaseSealosAuthGate();
          router.navigate({ to: "/login", replace: true });
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAndAuthenticate();
  }, [
    isInitialized,
    authContext.isAuthenticated,
    authContext.user,
    authContext.clearTentixSessionOnly,
    isSealos,
    sealosUserId,
    handleThirdPartyLogin,
    handleSealosLogin,
    navigateByRole,
    router,
    authContext,
  ]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center p-6">
          <h2 className="text-lg font-medium text-foreground mb-2">
            {t("auth_failed")}
          </h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => {
            // 首次认证阶段尚未打开工单表单，显式重试保持桌面渠道。
            window.location.reload();
          }}>重试认证</button>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">{t("initializing")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">
          {t("auth_complete_redirecting")}
        </p>
      </div>
    </div>
  );
}
