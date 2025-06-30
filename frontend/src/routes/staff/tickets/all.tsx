import { createFileRoute } from "@tanstack/react-router";
import { DataTable } from "@comp/tickets-table/table";
import { StaffDashboardSidebar } from "@comp/staff/dashboard-sidebar";

export const Route = createFileRoute("/staff/tickets/all")({
  head: () => ({
    meta: [
      {
        title: "全部工单列表 | Tentix",
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50">
      <StaffDashboardSidebar />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <DataTable character="staff" />
        </div>
      </div>
    </div>
  );
}
