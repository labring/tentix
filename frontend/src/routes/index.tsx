import {
  createFileRoute,
  useRouter,
  useRouteContext,
} from "@tanstack/react-router";
import { areaEnumArray } from "tentix-server/constants";
import { useAuth } from "../hooks/use-local-user";
import { useEffect, useState } from "react";
import { waitForSealosInit } from "../_provider/sealos";

export const Route = createFileRoute("/")({
  component: AuthGuard,
});

function AuthGuard() {
  const router = useRouter();
  const authContext = useAuth();
  const routeContext = useRouteContext({ from: "/" });
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAndAuthenticate = async () => {
      try {
        await waitForSealosInit();

        const identity = window.localStorage.getItem("identity");
        const area = window.localStorage.getItem("area");

        if (!identity || !area) {
          router.navigate({ to: "/notLogin", replace: true });
          return;
        }

        if (!authContext.isAuthenticated || !authContext.user) {
          const apiClient = routeContext.apiClient;
          const res = await (
            await apiClient.auth.login.$get({
              query: {
                token: identity,
                area: area as (typeof areaEnumArray)[number],
              },
            })
          ).json();

          window.localStorage.setItem("role", res.role);
          window.localStorage.setItem("id", res.id.toString());
          window.localStorage.setItem("token", res.token);

          const userData = await apiClient.user.info
            .$get()
            .then((r: any) => r.json());

          authContext.updateUser(
            userData,
            area as (typeof areaEnumArray)[number],
          );
        }

        const role = window.localStorage.getItem("role");

        switch (role) {
          case "technician":
          case "agent":
            router.navigate({ to: "/staff/dashboard", replace: true });
            break;
          default:
            router.navigate({ to: "/user/tickets/list", replace: true });
            break;
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        authContext.logout();
        router.navigate({ to: "/notLogin", replace: true });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAndAuthenticate();
  }, [router, authContext]);

  if (error) {
    return <div>认证失败: {error}</div>;
  }

  if (isInitializing) {
    return <div>正在初始化...</div>;
  }

  return <div>认证完成，正在跳转...</div>;
}
