import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ticketModulesConfigQueryOptions } from "@lib/query";
import { useAppConfigStore } from "@store/app-config";
import { useAuth } from "../hooks/use-local-user";
import { RouteTransition } from "@comp/page-transition";

export const Route = createFileRoute("/user")({
  beforeLoad: async ({ context: { authContext } }) => {
    if (authContext.user?.id === undefined || authContext.user === null) {
      redirect({
        to: "/",
        throw: true,
      });
    }
  },
  component: UserLayout,
});

function UserLayout() {
  const queryClient = useQueryClient();
  const setTicketModules = useAppConfigStore((state) => state.setTicketModules);
  const { isLoading } = useAuth();

  // 预加载 ticket modules 配置数据并设置到 store（使用 React Query）
  // global config
  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    queryClient
      .ensureQueryData(ticketModulesConfigQueryOptions())
      .then((configData) => {
        if (!cancelled && configData?.modules) {
          setTicketModules(configData.modules);
        }
      })
      .catch((err) => {
        console.error("Failed to preload ticket modules:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, queryClient, setTicketModules]);

  return (
    <RouteTransition>
      <Outlet />
    </RouteTransition>
  );
}
