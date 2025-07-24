import { createFileRoute } from "@tanstack/react-router";
import { PaginatedDataTable } from "@comp/tickets-table/paginated-table.tsx";
import { StaffSidebar } from "@comp/staff/sidebar";
import { userTicketsQueryOptions } from "@lib/query";
import { Suspense } from "react";
import { SkeletonTable } from "@comp/tickets-table/skeleton";
import { userTablePagination } from "@store/table-pagination";

export const Route = createFileRoute("/staff/tickets/list")({
  beforeLoad: () => {
    userTablePagination.getState().setStatuses(["pending", "in_progress"]);
    return {};
  },
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
    <div className="flex h-screen w-full overflow-hidden">
      <StaffSidebar />
      <Suspense fallback={<SkeletonTable />}>
        <PaginatedDataTable character="staff" initialData={data} />
      </Suspense>
    </div>
  );
}
