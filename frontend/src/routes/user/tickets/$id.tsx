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
import { Sidebar } from "@comp/user/sidebar";

export const Route = createFileRoute("/user/tickets/$id")({
  loader: async ({ context: { queryClient, authContext }, params }) => {
    return {
      data: await queryClient.fetchQuery(userTicketsQueryOptions()),
      ticket: await queryClient.fetchQuery(ticketsQueryOptions(params.id)),
      token: await queryClient.ensureQueryData(
        wsTokenQueryOptions(authContext.user?.id?.toString() ?? "1"),
      ),

      // data: await queryClient.ensureQueryData(userTicketsQueryOptions()),
      // ticket: await queryClient.ensureQueryData(ticketsQueryOptions(params.id)),
      // token: await queryClient.ensureQueryData(
      //   wsTokenQueryOptions(authContext.user?.id?.toString() ?? "1"),
      // ),
    };
  },
  preloadStaleTime: 0,
  staleTime: 0,
  component: RouteComponent,
});

function RouteComponent() {
  const { data, ticket, token } = Route.useLoaderData();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    setTicket(ticket);
    setSessionMembers(ticket);
  }, [ticket, setTicket, setSessionMembers]);

  if (data !== undefined && ticket !== undefined) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <UserTicketSidebar
          data={data.tickets}
          currentTicketId={ticket.id}
          isCollapsed={isSidebarCollapsed}
        />
        <div className="@container/main flex flex-1 flex-row">
          <div className="flex flex-col h-full w-[66%] xl:w-[74%]">
            <div className="flex-shrink-0">
              <SiteHeader
                title={ticket.title}
                sidebarVisible={!isSidebarCollapsed}
                toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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
