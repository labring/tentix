import {
  ticketsQueryOptions,
  userTicketsQueryOptions,
  wsTokenQueryOptions,
} from "@lib/query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSessionMembersStore, useTicketStore } from "tentix-ui/store";
import { StaffSiteHeader } from "tentix-ui/comp/staff/site-header";
import { StaffTicketSidebar } from "tentix-ui/comp/staff/staff-ticket-sidebar";
import { useBoolean } from "ahooks";
import { SidebarInset, SidebarProvider } from "tentix-ui/comp/ui/sidebar";
import { StaffChat } from "tentix-ui/comp/chat/staff/index";
import { StaffRightSidebar } from "tentix-ui/comp/staff/staff-right-sidebar";

export const Route = createFileRoute("/staff/tickets/$id")({
  loader: async ({ context: { queryClient, authContext }, params }) => {
    return {
      data: await queryClient.ensureQueryData(
        userTicketsQueryOptions(authContext.user!.id.toString()),
      ),
      ticket: await queryClient.ensureQueryData(ticketsQueryOptions(params.id)),
      token: await queryClient.ensureQueryData(
        wsTokenQueryOptions(authContext.user?.id.toString() ?? "1"),
      ),
      authContext: authContext,
    };
  },
  head: ({ params }) => ({
    meta: [
      {
        title: `工单#${params.id} | Tentix`,
      }
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { data, ticket, token: wsToken, authContext } = Route.useLoaderData();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const [isCollapsed, { toggle: toggleCollapse }] = useBoolean(false);

  // Set up initial ticket data
  useEffect(() => {
    setTicket(ticket);
    setSessionMembers(ticket);
  }, [ticket, setTicket, setSessionMembers]);

  return (
    <SidebarProvider>
      <StaffTicketSidebar currentTicketId={ticket.id} tickets={data} />
      <SidebarInset className="max-h-svh" style={{
          scrollbarGutter: 'stable both-edges',
          overflowY: 'clip',
        }}>
        <StaffSiteHeader
          ticket={ticket}
          sidebarVisible={!isCollapsed}
          toggleSidebar={toggleCollapse}
        />
        <div className="flex flex-1 flex-col h-[calc(100svh-48px)]">
          <div className="flex flex-1 flex-row h-full">
            <div className={`h-full flex flex-col flex-1`}>
              <StaffChat
                ticket={ticket}
                token={wsToken.token}
                userId={authContext.user?.id ?? 0}
              />
            </div>
            <StaffRightSidebar ticket={ticket} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
