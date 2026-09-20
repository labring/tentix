import { createFileRoute } from "@tanstack/react-router";
import { DataTable } from "@comp/tickets-table/table";
import { StaffSidebar } from "@comp/staff/sidebar";
import { allTicketsTablePagination } from "@store/table-pagination";
import { allTicketsQueryOptions } from "@lib/query";
import { Suspense } from "react";
import { SkeletonTable } from "@comp/tickets-table/skeleton";
import { RouteTransition } from "@comp/page-transition";
import i18nBase from "i18n";

export const Route = createFileRoute("/staff/tickets/all")({
  beforeLoad: () => {
    allTicketsTablePagination
      .getState()
      .initializeDefaultStatuses(["pending", "in_progress"]);
    return {};
  },
  loader: ({ context }) => {
    return context.queryClient.ensureQueryData(allTicketsQueryOptions());
  },
  head: () => ({
    meta: [
      {
        title: i18nBase.t("all_tickets_page_title"),
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();
  return (
    <RouteTransition>
      <div className="flex h-screen w-full overflow-hidden">
        <StaffSidebar />
        <Suspense fallback={<SkeletonTable />}>
          <DataTable initialData={data} />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
