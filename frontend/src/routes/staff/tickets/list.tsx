import { createFileRoute } from "@tanstack/react-router";
import { PaginatedDataTable } from "@comp/tickets-table/paginated-table.tsx";
import { StaffSidebar } from "@comp/staff/sidebar";
import { Suspense, useEffect } from "react";
import { SkeletonTable } from "@comp/tickets-table/skeleton";
import { userTablePagination } from "@store/table-pagination";
import { RouteTransition } from "@comp/page-transition";
import i18nBase, { useTranslation } from "i18n";

export const Route = createFileRoute("/staff/tickets/list")({
  beforeLoad: () => {
    userTablePagination
      .getState()
      .initializeDefaultStatuses(["pending", "in_progress"]);
    return {};
  },
  head: () => ({
    meta: [
      {
        title: i18nBase.t("ticket_list_page_title"),
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("ticket_list_page_title");
  }, [t]);

  return (
    <RouteTransition>
      <div className="flex h-screen w-full overflow-hidden">
        <StaffSidebar />
        <Suspense fallback={<SkeletonTable />}>
          <PaginatedDataTable character="staff" />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
