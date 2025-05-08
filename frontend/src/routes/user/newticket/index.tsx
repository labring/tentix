import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "tentix-ui/comp/site-header";
import { SidebarInset, SidebarProvider } from "tentix-ui/comp/ui/sidebar";
import { UserDashboardSidebar } from "tentix-ui/comp/user/dashboard-sidebar";
import { TicketForm } from "tentix-ui/comp/tickets/ticket-form";
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
