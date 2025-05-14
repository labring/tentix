



import { createFileRoute, redirect } from "@tanstack/react-router";
import { DataTable } from "tentix-ui/comp/tickets-table/table";
import { SiteHeader } from "tentix-ui/comp/site-header";
import { SidebarInset, SidebarProvider } from "tentix-ui/comp/ui/sidebar";
import { StaffDashboardSidebar } from "tentix-ui/comp/staff/dashboard-sidebar"
import { allTicketsQueryOptions } from "@lib/query";
import { Suspense } from "react";
import { SkeletonTable } from "tentix-ui/comp/tickets-table/skeleton";



export const Route = createFileRoute("/staff/tickets/all")({
  loader: ({ context }) => {
    return context.queryClient.ensureQueryData(allTicketsQueryOptions());
  },
  head: () => ({
    meta: [
      {
        title: "全部工单列表 | Tentix",
      }
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();
  return (
    <SidebarProvider>
      <StaffDashboardSidebar />
      <SidebarInset>
        <SiteHeader title="All Tickets" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Suspense fallback={<SkeletonTable />}>
                <DataTable data={data} character="staff" />
              </Suspense>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
