import { ticketsQueryOptions, wsTokenQueryOptions } from "@lib/query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { UserChat } from "@comp/chat/user/index.tsx";
import { SiteHeader } from "@comp/site-header.tsx";
import { TicketDetailsSidebar } from "@comp/tickets/ticket-details-sidebar.tsx";
import { useSessionMembersStore, useTicketStore } from "@store/index.ts";
import { userTicketsQueryOptions } from "@lib/query";
import { SidebarInset, SidebarProvider } from "tentix-ui";
import { UserTicketSidebar } from "@comp/user/user-ticket-sidebar.tsx";

export const Route = createFileRoute("/user/tickets/$id")({
  loader: async ({ context: { queryClient, authContext }, params }) => {
    return {
      data: await queryClient.ensureQueryData(
        userTicketsQueryOptions(),
      ),
      ticket: await queryClient.ensureQueryData(ticketsQueryOptions(params.id)),
      token: await queryClient.ensureQueryData(
        wsTokenQueryOptions(authContext.user?.id?.toString() ?? "1"),
      ),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { data, ticket, token } = Route.useLoaderData();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();

  useEffect(() => {
    setTicket(ticket);
    setSessionMembers(ticket);
  }, [ticket, setTicket, setSessionMembers]);

  if (data !== undefined && ticket !== undefined) {
    return (
      <SidebarProvider>
        <UserTicketSidebar data={data} currentTicketId={ticket.id} />
        <SidebarInset>
          <SiteHeader title={`Ticket #${ticket.id}: ${ticket.title}`} />
          <div className="flex flex-1 flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 flex-1">
              <div className="md:col-span-2 flex flex-col h-[calc(100vh-48px)]">
                <UserChat ticket={ticket} token={token.token} key={ticket.id} />
              </div>
              <TicketDetailsSidebar ticket={ticket} key={ticket.id} />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }
}
