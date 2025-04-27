
import { useUserGetTickets } from "@lib/index";


import { createFileRoute } from "@tanstack/react-router";
import { DataTable } from "@tentix/ui/comp/tickets-table/table";
import { SiteHeader } from "@tentix/ui/comp/site-header";
import { SidebarInset, SidebarProvider } from "@tentix/ui/comp/ui/sidebar";
import { UserDashboardSidebar } from "@tentix/ui/comp/user/dashboard-sidebar";
import { Suspense } from "react";


export const Route = createFileRoute("/user/tickets/")({
  // loader: async ({ context: { apiClient, queryClient } }) => {
  //   await queryClient.ensureQueryData(
  //     apiClient.user.getTickets.queryOptions({
  //       query: { id: "1" },
  //     }),
  //   );
  //   return;
  // },
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useUserGetTickets("12");

  return (
    <SidebarProvider>
      <UserDashboardSidebar />
      <SidebarInset>
        <SiteHeader title="My Tickets" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Suspense fallback={<div>Loading...</div>}>
                <DataTable data={data} character="user" />
              </Suspense>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
