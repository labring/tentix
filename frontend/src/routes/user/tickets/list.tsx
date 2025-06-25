import { createFileRoute } from "@tanstack/react-router";
import { PaginatedDataTable } from "@comp/tickets-table/paginated-table.tsx";
import { Suspense } from "react";
import { userTicketsQueryOptions } from "@lib/query";
import { SkeletonTable } from "@comp/tickets-table/skeleton";
import { Sidebar } from "@comp/user/sidebar";

export const Route = createFileRoute("/user/tickets/list")({
  loader: ({ context }) => {
    console.info("authcontext", context.authContext);
    return context.queryClient.ensureQueryData(userTicketsQueryOptions());
  },
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Suspense fallback={<SkeletonTable />}>
              <PaginatedDataTable character="user" initialData={data} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
