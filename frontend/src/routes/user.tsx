import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ticketModulesConfigQueryOptions, appConfigQueryOptions } from "@lib/query";
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
  const setForumUrl = useAppConfigStore((state) => state.setForumUrl);
  const { isLoading, isAuthenticated } = useAuth();

  // 预加载全局配置数据并设置到 store（使用 React Query）
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    
    Promise.all([
      queryClient.ensureQueryData(ticketModulesConfigQueryOptions()),
      queryClient.ensureQueryData(appConfigQueryOptions()),
    ])
      .then(([ticketModulesData, appConfigData]) => {
        if (cancelled) return;
        
        if (ticketModulesData?.modules) {
          setTicketModules(ticketModulesData.modules);
        }
        
        if (appConfigData?.forumUrl !== undefined) {
          setForumUrl(appConfigData.forumUrl);
        }
      })
      .catch((err) => {
        console.error("Failed to preload configurations:", err);
      });
    
    return () => {
      cancelled = true;
    };
  }, [isLoading, queryClient, setTicketModules, setForumUrl, isAuthenticated]);

  return (
    <RouteTransition>
      <Outlet />
    </RouteTransition>
  );
}
