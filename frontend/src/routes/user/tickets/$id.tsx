import { UserChat } from "@comp/chat/user/index.tsx";
import { SiteHeader } from "@comp/user/header.tsx";
import { TicketDetailsSidebar } from "@comp/user/ticket-details-sidebar";
import { UserTicketSidebar } from "@comp/user/user-ticket-sidebar.tsx";
import { ticketsQueryOptions, wsTokenQueryOptions } from "@lib/query";
import {
  useSessionMembersStore,
  useTicketStore,
  useChatStore,
} from "@store/index.ts";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@comp/user/sidebar";
import { PageTransition } from "@comp/page-transition";

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

  return (
    <PageTransition isLoading={isTicketLoading || !ticket}>
      {ticket && (
        <div className="flex h-screen w-full transition-all duration-300 ease-in-out">
          <Sidebar />
          <UserTicketSidebar
            currentTicketId={ticket.id}
            isCollapsed={isSidebarCollapsed}
            isTicketLoading={isTicketLoading}
          />
          <div className="@container/main flex flex-1">
            <div className="flex flex-col h-full w-[66%] xl:w-[74%]">
              <div className="flex-shrink-0">
                <SiteHeader
                  title={ticket.title}
                  sidebarVisible={!isSidebarCollapsed}
                  toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  ticket={ticket}
                />
              </div>
              <UserChat
                ticket={ticket}
                token={token.token}
                key={ticketId}
                isTicketLoading={isTicketLoading}
              />
            </div>
            <div className="flex flex-col h-full w-[34%] xl:w-[26%]">
              <TicketDetailsSidebar ticket={ticket} />
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
