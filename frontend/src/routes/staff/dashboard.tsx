import { createFileRoute, redirect } from "@tanstack/react-router";
import { StaffChartAreaInteractive } from "@comp/staff/chart-area-interactive";
import { DataTable } from "@comp/tickets-table/table";
import { StaffSectionCards } from "@comp/staff/section-cards";
import { SiteHeader } from "@comp/site-header";
import { SidebarInset, SidebarProvider } from "tentix-ui";
import { StaffDashboardSidebar } from "@comp/staff/dashboard-sidebar";
import { userTicketsQueryOptions } from "@lib/query";
import { joinTrans, useTranslation } from "i18n";

export const Route = createFileRoute("/staff/dashboard")({
  head: () => ({
    meta: [
      {
        title: "面板 | Tentix",
      }
    ],
  }),
  loader: async ({ context: { queryClient, authContext } }) => {
    return {
      data: await queryClient.ensureQueryData(
        userTicketsQueryOptions(authContext.user!.id.toString()),
      ),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = Route.useLoaderData();
  const { t } = useTranslation();
  return (
    <SidebarProvider>
      <StaffDashboardSidebar />
      <SidebarInset>
        <SiteHeader title={joinTrans([t("tkt_other"), t("dashboard")])} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <StaffSectionCards />
              <div className="px-4 lg:px-6">
                <StaffChartAreaInteractive />
              </div>
              <DataTable data={data} character="staff" />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
