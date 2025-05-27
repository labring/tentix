



import { createFileRoute  } from "@tanstack/react-router";
import { DataTable } from "@comp/tickets-table/table";
import { SiteHeader } from "@comp/site-header";
import { SidebarInset, SidebarProvider } from "tentix-ui";
import { StaffDashboardSidebar } from "@comp/staff/dashboard-sidebar"
import { userTicketsQueryOptions } from "@lib/query";
import { Suspense } from "react";
import { SkeletonTable } from "@comp/tickets-table/skeleton";



export const Route = createFileRoute("/staff/tickets/list")({
  loader: ({ context }) => {
    return context.queryClient.ensureQueryData(userTicketsQueryOptions());
  },
  head: () => ({
    meta: [
      {
        title: "工单列表 | Tentix",
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
