import { ticketsQueryOptions, wsTokenQueryOptions } from "@lib/query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useSessionMembersStore,
  useTicketStore,
  useChatStore,
} from "../../../store";
import { StaffSiteHeader } from "@comp/staff/site-header";
import { StaffTicketSidebar } from "@comp/staff/staff-ticket-sidebar";
import { StaffRightSidebar } from "@comp/staff/staff-right-sidebar";
import { StaffChat } from "@comp/chat/staff/index";
import { StaffSidebar } from "@comp/staff/sidebar";

export const Route = createFileRoute("/staff/tickets/$id")({
  loader: async ({ context: { queryClient, authContext } }) => {
    // 如果没有认证，返回null数据，让 staff.tsx 处理重定向
    if (!authContext.isAuthenticated || !authContext.user) {
      return {
        token: null,
      };
    }
    return {
      token: await queryClient.ensureQueryData(
        wsTokenQueryOptions(authContext.user.id.toString()),
      ),
    };
  },
  head: ({ params }) => ({
    meta: [
      {
        title: `工单#${params.id} | Tentix`,
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { token: wsToken } = Route.useLoaderData();
  const { id: ticketId } = Route.useParams();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const { setCurrentTicketId, clearMessages } = useChatStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 在组件中获取当前 ticket 数据，这样可以响应 invalidateQueries
  // enabled 确保只有在 wsToken 存在时才发起请求 （wsToken 存在时，说明已经认证）, 防止飞书认证时 api-client.ts 401 错误触发全局重定向
  const { data: ticket, isLoading: isTicketLoading } = useQuery({
    ...ticketsQueryOptions(ticketId),
    enabled: !!wsToken,
  });

  // Set up initial ticket data - 所有 hooks 必须在条件渲染之前调用
  useEffect(() => {
    if (ticket) {
      setTicket(ticket);
      setSessionMembers(ticket);
    }
  }, [ticket, setTicket, setSessionMembers]);

  // 路由切换时的清理
  useEffect(() => {
    // 路由切换时设置新的 ticketId
    if (ticket) {
      setCurrentTicketId(ticket.id);
    }

    return () => {
      // 当路由组件卸载时，清理全局状态
      setTicket(null);
      setSessionMembers(null);
      setCurrentTicketId(null);
      clearMessages();
    };
  }, [ticketId]); // 依赖 id，确保路由切换时触发

  // 如果数据为空（未认证），显示加载状态
  if (!wsToken) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  if (isTicketLoading || !ticket) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading Ticket...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full transition-all duration-300 ease-in-out">
      <StaffSidebar />
      <StaffTicketSidebar
        currentTicketId={ticket.id}
        isTicketLoading={isTicketLoading}
        isCollapsed={isSidebarCollapsed}
      />
      <div className="@container/main flex flex-1 flex-row">
        {/* <div className="flex flex-col h-full w-[66%] xl:w-[74%]"> */}
        <div className="flex flex-col h-full w-full md:w-[66%] xl:w-[74%]">
          <div className="flex-shrink-0">
            <StaffSiteHeader
              ticket={ticket}
              sidebarVisible={!isSidebarCollapsed}
              toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          </div>
          {/* 使用 key={ticketId} 确保组件在路由切换时完全重新创建 */}
          <StaffChat
            ticket={ticket}
            token={wsToken.token}
            key={ticketId}
            isTicketLoading={isTicketLoading}
          />
        </div>
        {/* <div className="flex flex-col h-full w-[34%] xl:w-[26%]"> */}
        <div className="hidden md:flex flex-col h-full w-[34%] xl:w-[26%]">
          {/* 同样使用 key 确保侧边栏也重新创建 */}
          <StaffRightSidebar ticket={ticket} />
        </div>
      </div>
    </div>
  );
}
