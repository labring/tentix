import { Link, useLocation } from '@tanstack/react-router'
import { joinTrans, useTranslation } from "i18n"
import { LayoutDashboard, Ticket } from "lucide-react"
import { cn, ScrollArea } from "tentix-ui"
export function StaffDashboardSidebar() {
  const pathname = useLocation().pathname;
  const { t } = useTranslation();


  return (
    <div className="border-r bg-background capitalize">
      <ScrollArea className="h-full">
        <div className="flex h-full flex-col gap-2 p-2">
          <div className="flex h-14 items-center border-b px-4">
            <Link to="/staff/dashboard" className="flex items-center gap-2 font-semibold">
              <LayoutDashboard className="h-5 w-5" />
              <span>{t("tkt_system")}</span>
            </Link>
          </div>
          <div className="flex-1 py-2">
            <nav className="grid gap-1 px-2">
              <Link
                to="/staff/dashboard"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/dashboard" ? "bg-accent" : "transparent",
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                {t("dashboard")}
              </Link>
              <Link
                to="/staff/tickets/list"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/tickets" || pathname.startsWith("/staff/tickets/") ? "bg-accent" : "transparent",
                )}
              >
                <Ticket className="h-4 w-4" />
                {t("tkt_list")}
              </Link>
              <Link
                to="/staff/tickets/all"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/tickets/all" ? "bg-accent" : "transparent",
                )}
              >
                <Ticket className="h-4 w-4" />
                {joinTrans([t("all"), t("tkt_other")])}
              </Link>
              {/* <Link
                to="/staff/team"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/team" ? "bg-accent" : "transparent",
                )}
              >
                <Users className="h-4 w-4" />
                {t("team")}
              </Link>
              <Link
                to="/staff/reports"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/reports" ? "bg-accent" : "transparent",
                )}
              >
                <BarChart className="h-4 w-4" />
                {t("reports")}
              </Link>
              <Link
                to="/staff/knowledge-base"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/knowledge-base" ? "bg-accent" : "transparent",
                )}
              >
                <FileText className="h-4 w-4" />
                {t("klg_base")}
              </Link>
              <Link
                to="/staff/docs-management"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/docs-management" || pathname.startsWith("/staff/docs-management/")
                    ? "bg-accent"
                    : "transparent",
                )}
              >
                <FileText className="h-4 w-4" />
                {t("docs_management")}
              </Link>
              <Link
                to="/staff/notifications"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/notifications" ? "bg-accent" : "transparent",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                {t("ntfcs")}
              </Link>
              <Link
                to="/staff/settings"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/settings" ? "bg-accent" : "transparent",
                )}
              >
                <Settings className="h-4 w-4" />
                {t("settings")}
              </Link> */}
            </nav>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
