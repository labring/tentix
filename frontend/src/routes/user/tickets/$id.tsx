import { UserChat } from "@comp/chat/user/index.tsx";
import { SiteHeader } from "@comp/user/header.tsx";
import { TicketDetailsSidebar } from "@comp/tickets/ticket-details-sidebar.tsx";
import { UserTicketSidebar } from "@comp/user/user-ticket-sidebar.tsx";
import {
  ticketsQueryOptions,
  userTicketsQueryOptions,
  wsTokenQueryOptions,
} from "@lib/query";
import { useSessionMembersStore, useTicketStore } from "@store/index.ts";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 在组件中获取用户 tickets 数据，这样可以响应 invalidateQueries
  const { data: userTicketsData, isLoading: isUserTicketsLoading } = useQuery(
    userTicketsQueryOptions(),
  );

  // 在组件中获取当前 ticket 数据，这样可以响应 invalidateQueries
  const { data: ticket, isLoading: isTicketLoading } = useQuery(
    ticketsQueryOptions(ticketId),
  );

  useEffect(() => {
    if (ticket) {
      setTicket(ticket);
      setSessionMembers(ticket);
    }
  }, [ticket, setTicket, setSessionMembers]);

  if (isTicketLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (ticket !== undefined) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <UserTicketSidebar
          data={userTicketsData?.tickets || []}
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
            <UserChat ticket={ticket} token={token.token} key={ticket.id} />
          </div>
          <div className="flex flex-col h-full w-[34%] xl:w-[26%]">
            <TicketDetailsSidebar ticket={ticket} key={ticket.id} />
          </div>
        </div>
      </div>
    );
  }
}
