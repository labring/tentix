import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@comp/site-header";
import { SidebarInset, SidebarProvider } from "tentix-ui";
import { UserDashboardSidebar } from "@comp/user/dashboard-sidebar";
import { TicketForm } from "@comp/tickets/ticket-form";
import { useTranslation } from "i18n";
export const Route = createFileRoute("/user/newticket/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  return (
    <SidebarProvider>
      <UserDashboardSidebar />
      <SidebarInset>
        <SiteHeader title={t("create_new_ticket")} />
        <TicketForm />
      </SidebarInset>
    </SidebarProvider>
  );
}
