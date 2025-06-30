import {
  ticketsQueryOptions,
  userTicketsQueryOptions,
  wsTokenQueryOptions,
} from "@lib/query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSessionMembersStore, useTicketStore } from "../../../store";
import { StaffSiteHeader } from "@comp/staff/site-header";
import { StaffTicketSidebar } from "@comp/staff/staff-ticket-sidebar";
import { StaffChat } from "@comp/chat/staff/index";
import { StaffRightSidebar } from "@comp/staff/staff-right-sidebar";
import { StaffDashboardSidebar } from "@comp/staff/dashboard-sidebar";

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
      data: await queryClient.ensureQueryData(userTicketsQueryOptions()),
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
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { data, ticket: loaderTicket, token: wsToken } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { setTicket } = useTicketStore();
  const { setSessionMembers } = useSessionMembersStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 在组件中获取用户 tickets 数据，这样可以响应 invalidateQueries
  const { data: userTicketsData } = useQuery(
    userTicketsQueryOptions(),
  );

  // 在组件中获取当前 ticket 数据，这样可以响应 invalidateQueries
  const { data: ticket, isLoading: isTicketLoading } = useQuery(
    ticketsQueryOptions(id),
  );

  // Set up initial ticket data - 所有 hooks 必须在条件渲染之前调用
  useEffect(() => {
    const currentTicket = ticket || loaderTicket;
    if (currentTicket) {
      setTicket(currentTicket);
      setSessionMembers(currentTicket);
    }
  }, [ticket, loaderTicket, setTicket, setSessionMembers]);

  // 如果数据为空（未认证），显示加载状态
  if (!data || !loaderTicket || !wsToken) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  if (isTicketLoading && !loaderTicket) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // 使用组件中的最新数据，如果正在加载则使用 loader 的数据作为fallback
  const currentTicket = ticket || loaderTicket;
  const currentUserTickets = userTicketsData || data;

  // 此时我们知道 loaderTicket 不为 null（因为上面已经检查过），
  // 所以 currentTicket 也不会为 null，但需要类型断言来告诉 TypeScript
  if (!currentTicket) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Ticket not found</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <StaffDashboardSidebar />
      <StaffTicketSidebar
        currentTicketId={currentTicket.id}
        tickets={currentUserTickets?.tickets || []}
        isCollapsed={isSidebarCollapsed}
      />
      <div className="@container/main flex flex-1 flex-row">
        <div className="flex flex-col h-full w-[66%] xl:w-[74%]">
          <div className="flex-shrink-0">
            <StaffSiteHeader
              ticket={currentTicket}
              sidebarVisible={!isSidebarCollapsed}
              toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          </div>
          <StaffChat
            ticket={currentTicket}
            token={wsToken.token}
            key={currentTicket.id}
          />
        </div>
        <div className="flex flex-col h-full w-[34%] xl:w-[26%]">
          <StaffRightSidebar id={id} />
        </div>
      </div>
    </div>
  );
}
