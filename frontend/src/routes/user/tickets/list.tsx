import { createFileRoute } from "@tanstack/react-router";
import { PaginatedDataTable } from "@comp/tickets-table/paginated-table.tsx";
import { Suspense } from "react";
import { userTicketsQueryOptions } from "@lib/query";
import { SkeletonTable } from "@comp/tickets-table/skeleton";
import { Sidebar } from "@comp/user/sidebar";

export const Route = createFileRoute("/user/tickets/list")({
  loader: ({ context }) => {
    return context.queryClient.fetchQuery(userTicketsQueryOptions());
  },
  preloadStaleTime: 0,
  staleTime: 0,
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <Suspense fallback={<SkeletonTable />}>
        <PaginatedDataTable character="user" initialData={data} />
      </Suspense>
    </div>
  );
}
