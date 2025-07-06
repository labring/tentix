import { UserChat } from "@comp/chat/user/index.tsx";
import { SiteHeader } from "@comp/user/header.tsx";
import { TicketDetailsSidebar } from "@comp/tickets/ticket-details-sidebar.tsx";
import { UserTicketSidebar } from "@comp/user/user-ticket-sidebar.tsx";
import {
  ticketsQueryOptions,
  userTicketsQueryOptions,
  wsTokenQueryOptions,
} from "@lib/query";
import {
  useSessionMembersStore,
  useTicketStore,
  useChatStore,
} from "@store/index.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@comp/user/sidebar";

export const Route = createFileRoute("/user/tickets/$id")({
  loader: async ({ context: { queryClient, authContext } }) => {
    return {
      token: await queryClient.ensureQueryData(
        wsTokenQueryOptions(authContext.user?.id?.toString() ?? "1"),
      ),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useLoaderData();
  const { id: ticketId } = Route.useParams();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const { setCurrentTicketId, clearMessages } = useChatStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 在组件中获取用户 tickets 数据，这样可以响应 invalidateQueries
  // 数据立即过期，每次组件挂载时重新获取 ,窗口聚焦时重新获取
  const { data: userTicketsData, isLoading: isUserTicketsLoading } = useQuery(
    userTicketsQueryOptions(40, 1, ticketId.toString()),
  );

  // 在组件中获取当前 ticket 数据，这样可以响应 invalidateQueries
  // 数据立即过期，每次组件挂载时重新获取 ,窗口聚焦时重新获取
  const { data: ticket, isLoading: isTicketLoading } = useQuery(
    ticketsQueryOptions(ticketId),
  );

  // 设置 ticket 和 sessionMembers
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
  }, [ticketId]); // 依赖 ticketId，确保路由切换时触发

  if (isTicketLoading || isUserTicketsLoading || !ticket) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <UserTicketSidebar
        data={userTicketsData!.tickets}
        currentTicketId={ticket.id}
        isCollapsed={isSidebarCollapsed}
        isLoading={isUserTicketsLoading}
      />
      <div className="@container/main flex flex-1 flex-row">
        <div className="flex flex-col h-full w-[66%] xl:w-[74%]">
          <div className="flex-shrink-0">
            <SiteHeader
              title={ticket.title}
              sidebarVisible={!isSidebarCollapsed}
              toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              ticket={ticket}
            />
          </div>
          {/* 使用 key={ticketId} 确保组件在路由切换时完全重新创建 */}
          <UserChat
            ticket={ticket}
            token={token.token}
            key={ticketId}
            isTicketLoading={isTicketLoading}
          />
        </div>
        <div className="flex flex-col h-full w-[34%] xl:w-[26%]">
          {/* 同样使用 key 确保侧边栏也重新创建 */}
          <TicketDetailsSidebar ticket={ticket} key={ticketId} />
        </div>
      </div>
    </div>
  );
}
