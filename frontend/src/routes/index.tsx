import {
  createFileRoute,
  useRouter,
  useRouteContext,
} from "@tanstack/react-router";
import { areaEnumArray } from "tentix-server/constants";
import {
  TENTIX_SEALOS_USER_ID_KEY,
  useAuth,
} from "../hooks/use-local-user";
import { useEffect, useState, useCallback } from "react";
import {
  releaseSealosAuthGate,
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

  // 根据角色导航到对应页面
  const navigateByRole = useCallback(
    (role: string) => {
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

  // 处理 Sealos 登录
  const handleSealosLogin = useCallback(async () => {
    const sealosToken = window.localStorage.getItem("sealosToken");
    const sealosArea = window.localStorage.getItem("sealosArea");

    if (!sealosToken || !sealosArea) {
      router.navigate({ to: "/notLogin", replace: true });
      return;
    }

    const apiClient = routeContext.apiClient;
    const res = await apiClient.auth.sealos
      .$post({
        json: {
          token: sealosToken,
          userInfo: {
            name: sealosUser?.name ?? "",
            avatar: sealosUser?.avatar ?? "",
          },
        },
      })
      .then((r) => r.json());

    // 保存认证信息
    window.localStorage.setItem("role", res.role);
    window.localStorage.setItem("id", res.id.toString());
    window.localStorage.setItem("token", res.token);
    if (!sealosUserId) {
      throw new Error("Sealos user id is missing");
    }
    window.localStorage.setItem(TENTIX_SEALOS_USER_ID_KEY, sealosUserId);
    releaseSealosAuthGate();

    // 获取并更新用户信息
    const userData = await apiClient.user.info.$get().then((r) => r.json());
    authContext.updateUser(
      userData,
      sealosArea as (typeof areaEnumArray)[number],
      sealosUser?.nsid ?? "",
    );
    authContext.setIsAuthenticated(true);

    // 导航
    navigateByRole(res.role);
  }, [
    router,
    routeContext.apiClient,
    sealosUser,
    sealosUserId,
    authContext,
    navigateByRole,
  ]);

  useEffect(() => {
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

        const storedSealosUserId = window.localStorage.getItem(
          TENTIX_SEALOS_USER_ID_KEY,
        );
        const hasTentixToken = window.localStorage.getItem("token") !== null;
        const sealosUserMismatch = Boolean(
          isSealos &&
            sealosUserId &&
            storedSealosUserId &&
            storedSealosUserId !== sealosUserId,
        );

        if (sealosUserMismatch) {
          authContext.clearTentixSessionOnly();
        }

        // 2. 处理 Sealos 环境登录
        if (
          isSealos &&
          (!hasTentixToken ||
            !authContext.isAuthenticated ||
            !authContext.user ||
            sealosUserMismatch)
        ) {
          await handleSealosLogin();
          return;
        }

        if (isSealos) {
          releaseSealosAuthGate();
        }

        // 3. 处理普通环境
        if (!authContext.isAuthenticated || !authContext.user) {
          router.navigate({ to: "/login", replace: true });
          return;
        }

        // 4. 已认证用户：导航
        const role = window.localStorage.getItem("role");
        if (role) {
          navigateByRole(role);
        }
      } catch (error) {
        releaseSealosAuthGate();
        console.error("Authentication error:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        authContext.logout();
        router.navigate({
          to: isSealos ? "/notLogin" : "/login",
          replace: true,
        });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAndAuthenticate();
  }, [
    isInitialized,
    authContext.isAuthenticated,
    authContext.user,
    authContext.logout,
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
