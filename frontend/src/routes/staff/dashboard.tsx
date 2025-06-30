import { createFileRoute } from "@tanstack/react-router";
import { StaffChartAreaInteractive } from "@comp/staff/chart-area-interactive";
import { StaffSectionCards } from "@comp/staff/section-cards";
import { StaffDashboardSidebar } from "@comp/staff/dashboard-sidebar";
import { userTicketsQueryOptions } from "@lib/query";

export const Route = createFileRoute("/staff/dashboard")({
  head: () => ({
    meta: [
      {
        title: "面板 | Tentix",
      },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    return {
      data: await queryClient.ensureQueryData(userTicketsQueryOptions()),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <StaffDashboardSidebar />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <StaffSectionCards />
          <div className="px-4 lg:px-6">
            <StaffChartAreaInteractive />
          </div>
        </div>
      </div>
    </div>
  );
}
