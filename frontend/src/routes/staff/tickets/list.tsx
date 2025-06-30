import { createFileRoute } from "@tanstack/react-router";
import { PaginatedDataTable } from "@comp/tickets-table/paginated-table.tsx";
import { StaffDashboardSidebar } from "@comp/staff/dashboard-sidebar";
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
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50">
      <StaffDashboardSidebar />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Suspense fallback={<SkeletonTable />}>
              <PaginatedDataTable character="staff" initialData={data} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
