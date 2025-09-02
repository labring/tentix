import {
  createFileRoute,
  useRouter,
  useRouteContext,
} from "@tanstack/react-router";
import { areaEnumArray } from "tentix-server/constants";
import { useAuth } from "../hooks/use-local-user";
import { useEffect, useState } from "react";
import { useSealos, waitForSealosInit } from "../_provider/sealos";
import { useTranslation } from "i18n";

export const Route = createFileRoute("/")({
  component: AuthGuard,
});

function AuthGuard() {
  const { t } = useTranslation();
  const router = useRouter();
  const authContext = useAuth();
  const sealosContext = useSealos();
  const { sealosUser, isSealos, isInitialized } = sealosContext;
  const routeContext = useRouteContext({ from: "/" });
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAndAuthenticate = async () => {
      try {
        await waitForSealosInit();

        if (!isInitialized) {
          return;
        }

        if (isSealos) {
          // Sealos environment logic
          const sealosToken = window.localStorage.getItem("sealosToken");
          const sealosArea = window.localStorage.getItem("sealosArea");

          if (!sealosToken || !sealosArea) {
            router.navigate({ to: "/notLogin", replace: true });
            return;
          }

          if (!authContext.isAuthenticated || !authContext.user) {
            const apiClient = routeContext.apiClient;
            const res = await (
              await apiClient.auth.sealos.$post({
                json: {
                  token: sealosToken,
                  userInfo: {
                    name: sealosUser?.name ?? "",
                    avatar: sealosUser?.avatar ?? "",
                  },
                },
              })
            ).json();

            window.localStorage.setItem("role", res.role);
            window.localStorage.setItem("id", res.id.toString());
            window.localStorage.setItem("token", res.token);

            const userData = await apiClient.user.info
              .$get()
              .then((r) => r.json());

            authContext.updateUser(
              userData,
              sealosArea as (typeof areaEnumArray)[number],
              sealosUser?.nsid ?? "",
            );
            authContext.setIsAuthenticated(true);
          }

          const role = window.localStorage.getItem("role");

          switch (role) {
            case "technician":
            case "agent":
              router.navigate({ to: "/staff/tickets/list", replace: true });
              break;
            default:
              router.navigate({ to: "/user/tickets/list", replace: true });
              break;
          }
        } else {
          // Non-Sealos environment logic
          if (!authContext.isAuthenticated || !authContext.user) {
            router.navigate({ to: "/login", replace: true });
            return;
          }

          const role = window.localStorage.getItem("role");

          switch (role) {
            case "technician":
            case "agent":
              router.navigate({ to: "/staff/tickets/list", replace: true });
              break;
            default:
              router.navigate({ to: "/user/tickets/list", replace: true });
              break;
          }
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        authContext.logout();
        if (isSealos) {
          router.navigate({ to: "/notLogin", replace: true });
        } else {
          router.navigate({ to: "/login", replace: true });
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAndAuthenticate();
  }, [
    router,
    authContext,
    isSealos,
    isInitialized,
    sealosUser,
    routeContext.apiClient,
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
