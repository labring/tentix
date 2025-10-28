import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { areaEnumArray } from "tentix-server/constants";
import { useAuth } from "../hooks/use-local-user";
import { z } from "zod";
import { ticketModulesConfigQueryOptions, appConfigQueryOptions } from "@lib/query";
import { useAppConfigStore } from "@store/app-config";
import { useQueryClient } from "@tanstack/react-query";

// TODO: 如何处理多种 oauth 登录方式
export const Route = createFileRoute("/staff")({
  validateSearch: z
    .object({
      token: z.string().optional(),
    })
    .passthrough(),
  beforeLoad: async ({ search, context, location }) => {
    // 如果有token参数，处理飞书登录回调
    if (search.token) {
      window.localStorage.setItem("token", search.token);
      context.authContext.setIsAuthenticated(true);
      context.authContext.setIsLoading(true);

      // 立即获取用户信息并更新 AuthContext，确保状态完整
      try {
        const userData = await context.apiClient.user.info
          .$get()
          .then((r) => r.json());

        if (!userData || userData.id === 0) {
          throw new Error("Invalid user data");
        }

        // 更新用户信息到 AuthContext（updateUser 内部会设置 isLoading = false）
        context.authContext.updateUser(
          userData,
          "hzh" as (typeof areaEnumArray)[number],
          "default-ns",
        );

        // 等待一个短暂的时间确保状态更新
        await new Promise((resolve) => setTimeout(resolve, 50));

        // 重定向去掉URL参数
        window.location.href = location.pathname;
        return;
      } catch (error) {
        console.error("Failed to fetch user info during callback:", error);
        window.localStorage.removeItem("token");
        context.authContext.logout();
        context.authContext.setIsAuthenticated(false);
        context.authContext.setIsLoading(false);
        window.location.href = `/api/feishu/login?redirect=${location.href}`;
        return;
      }
    }

    // 检查认证状态
    const hasToken = window.localStorage.getItem("token") !== null;

    // 未认证
    if (!hasToken) {
      // 没有token，跳转飞书登录
      // 用 location.href 而不是 location.pathname 是因为 location.pathname 不包含查询参数
      window.location.href = `/api/feishu/login?redirect=${location.href}`;
      return;
    }

    // 如果有 token 但没有用户信息，获取用户信息
    if (!context.authContext.user) {
      context.authContext.setIsLoading(true);

      try {
        const userData = await context.apiClient.user.info
          .$get()
          .then((r) => r.json());

        if (!userData || userData.id === 0) {
          throw new Error("Invalid user data");
        }

        // 更新用户信息到 AuthContext（updateUser 内部会设置 isLoading = false）
        context.authContext.updateUser(
          userData,
          "hzh" as (typeof areaEnumArray)[number],
          "default-ns",
        );

        // 等待状态更新完成
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error("Failed to fetch user info:", error);
        // 用户信息获取失败，可能token已过期，重新认证
        window.localStorage.removeItem("token");
        context.authContext.logout();
        context.authContext.setIsAuthenticated(false);
        context.authContext.setIsLoading(false);
        window.location.href = `/api/feishu/login?redirect=${location.href}`;
        return;
      }
    }

    // 最后检查：确保有用户信息才继续
    if (!context.authContext.user) {
      console.error("User info still not available after fetch");
      window.location.href = `/api/feishu/login?redirect=${location.href}`;
      return;
    }

    // 如果用户是customer角色，重定向到用户页面
    if (context.authContext.user.role === "customer") {
      redirect({ to: "/user/tickets/list" });
      return;
    }
  },
  component: StaffLayout,
});

function StaffLayout() {
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

  // 如果正在加载用户数据阶段，或者未认证阶段，显示加载页面而不是错误页面
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
