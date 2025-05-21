



import { createFileRoute } from "@tanstack/react-router";
import { DataTable } from "@comp/tickets-table/table";
import { SiteHeader } from "@comp/site-header";
import { SidebarInset, SidebarProvider } from "tentix-ui";
import { UserDashboardSidebar } from "@comp/user/dashboard-sidebar";
import { Suspense } from "react";
import { userTicketsQueryOptions} from "@lib/query";
import { SkeletonTable } from "@comp/tickets-table/skeleton";



export const Route = createFileRoute("/user/tickets/list")({
  loader: ({ context }) => {
    return context.queryClient.ensureQueryData(userTicketsQueryOptions(context.authContext.user!.id.toString()));
  },
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();
  return (
    <SidebarProvider>
      <UserDashboardSidebar />
      <SidebarInset>
        <SiteHeader title="My Tickets" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Suspense fallback={<SkeletonTable />}>
                <DataTable data={data} character="user" />
              </Suspense>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
