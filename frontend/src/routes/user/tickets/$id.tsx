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
import { useAuth } from "src/_provider/auth";
import { useSealos } from "src/_provider/sealos";

export const Route = createFileRoute("/user/tickets/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const { id: ticketId } = Route.useParams();
  const { user } = useAuth();
  const {
    isSealos,
    isInitialized,
    sealosKubeconfig,
    refreshSealosSession,
  } = useSealos();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const { setCurrentTicketId, clearMessages } = useChatStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { data: wsToken, isLoading: isWsTokenLoading } = useQuery({
    ...wsTokenQueryOptions({
      testUserId: user?.id?.toString(),
      ticketId,
      getSealosKubeconfig: isSealos
        ? async () => {
            const latest = await refreshSealosSession();
            return latest?.sealosKubeconfig ?? sealosKubeconfig;
          }
        : undefined,
    }),
    enabled: !!user && (!isSealos || isInitialized),
  });
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

  // 当前 ticket 数据可用后，同步当前 room id
  useEffect(() => {
    if (ticket) {
      setCurrentTicketId(ticket.id);
    }
  }, [ticket, setCurrentTicketId]);

  // 路由切换时的清理
  useEffect(() => {
    return () => {
      // 当路由组件卸载时，清理全局状态
      setTicket(null);
      setSessionMembers(null);
      setCurrentTicketId(null);
      clearMessages();
    };
  }, [
    ticketId,
    setTicket,
    setSessionMembers,
    setCurrentTicketId,
    clearMessages,
  ]); // 依赖 ticketId，确保路由切换时触发

  return (
    <PageTransition
      isLoading={isTicketLoading || isWsTokenLoading || !ticket || !wsToken}
    >
      {ticket && wsToken && (
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
                token={wsToken.token}
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
