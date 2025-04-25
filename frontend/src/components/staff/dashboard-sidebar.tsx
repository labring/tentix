import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LayoutDashboard, Ticket, Settings, Users, FileText, BarChart, MessageSquare } from "lucide-react"

export function StaffDashboardSidebar() {
  const pathname = usePathname()

  return (
    <div className="border-r bg-background">
      <ScrollArea className="h-full">
        <div className="flex h-full flex-col gap-2 p-2">
          <div className="flex h-14 items-center border-b px-4">
            <Link href="/staff/dashboard" className="flex items-center gap-2 font-semibold">
              <LayoutDashboard className="h-5 w-5" />
              <span>Work Order System</span>
            </Link>
          </div>
          <div className="flex-1 py-2">
            <nav className="grid gap-1 px-2">
              <Link
                href="/staff/dashboard"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/dashboard" ? "bg-accent" : "transparent",
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/staff/tickets"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/tickets" || pathname.startsWith("/staff/tickets/") ? "bg-accent" : "transparent",
                )}
              >
                <Ticket className="h-4 w-4" />
                Tickets
              </Link>
              <Link
                href="/staff/team"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/team" ? "bg-accent" : "transparent",
                )}
              >
                <Users className="h-4 w-4" />
                Team
              </Link>
              <Link
                href="/staff/reports"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/reports" ? "bg-accent" : "transparent",
                )}
              >
                <BarChart className="h-4 w-4" />
                Reports
              </Link>
              <Link
                href="/staff/knowledge-base"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/knowledge-base" ? "bg-accent" : "transparent",
                )}
              >
                <FileText className="h-4 w-4" />
                Knowledge Base
              </Link>
              <Link
                href="/staff/docs-management"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/docs-management" || pathname.startsWith("/staff/docs-management/")
                    ? "bg-accent"
                    : "transparent",
                )}
              >
                <FileText className="h-4 w-4" />
                Documentation
              </Link>
              <Link
                href="/staff/messages"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/messages" ? "bg-accent" : "transparent",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Messages
              </Link>
              <Link
                href="/staff/settings"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === "/staff/settings" ? "bg-accent" : "transparent",
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
