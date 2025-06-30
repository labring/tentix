import {
  ticketsQueryOptions,
  userTicketsQueryOptions,
  wsTokenQueryOptions,
} from "@lib/query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSessionMembersStore, useTicketStore } from "../../../store";
import { StaffSiteHeader } from "@comp/staff/site-header";
import { StaffTicketSidebar } from "@comp/staff/staff-ticket-sidebar";
import { useBoolean } from "ahooks";
import { SidebarInset, SidebarProvider } from "tentix-ui";
import { StaffChat } from "@comp/chat/staff/index";
import { StaffRightSidebar } from "@comp/staff/staff-right-sidebar";

export const Route = createFileRoute("/staff/tickets/$id")({
  loader: async ({ context: { queryClient, authContext }, params }) => {
    // 如果没有认证，返回null数据，让beforeLoad处理重定向
    if (!authContext.isAuthenticated || !authContext.user) {
      return {
        data: null,
        ticket: null,
        token: null,
        authContext,
      };
    }

    return {
      data: await queryClient.ensureQueryData(
        userTicketsQueryOptions(),
      ),
      ticket: await queryClient.ensureQueryData(ticketsQueryOptions(params.id)),
      token: await queryClient.ensureQueryData(
        wsTokenQueryOptions(authContext.user.id.toString()),
      ),
      authContext,
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
  const { id } = Route.useParams();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const [isCollapsed, { toggle: toggleCollapse }] = useBoolean(false);

  // Set up initial ticket data
  useEffect(() => {
    if (ticket) {
      setTicket(ticket);
      setSessionMembers(ticket);
    }
  }, [ticket, setTicket, setSessionMembers]);

  // 如果数据为空（未认证），显示加载状态
  if (!data || !ticket || !wsToken) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <StaffTicketSidebar currentTicketId={id} tickets={data.tickets} />
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
            <StaffRightSidebar id={id} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
