import {
  BarChartIcon,
  ClipboardListIcon,
  CogIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"

const userData = {
  name: "Admin User",
  email: "admin@example.com",
  avatar: "/avatars/shadcn.jpg",
}

const navItems = {
  staff: [
    {
      title: "Dashboard",
      url: "/staff/dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Tickets",
      url: "/staff/tickets",
      icon: ClipboardListIcon,
    },
    {
      title: "Analytics",
      url: "/staff/analytics",
      icon: BarChartIcon,
    },
    {
      title: "Team",
      url: "/staff/team",
      icon: UsersIcon,
    },
    {
      title: "Settings",
      url: "/staff/settings",
      icon: CogIcon,
    },
  ],
  user: [
    {
      title: "Dashboard",
      url: "/user/dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      title: "My Tickets",
      url: "/user/tickets",
      icon: ClipboardListIcon,
    },
    {
      title: "Settings",
      url: "/user/settings",
      icon: CogIcon,
    },
  ],
}

const secondaryNavItems = [
  {
    title: "Help Center",
    url: "/help",
    icon: HelpCircleIcon,
  },
  {
    title: "Search",
    url: "/search",
    icon: SearchIcon,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: SettingsIcon,
  },
]

interface DashboardSidebarProps {
  role: "user" | "staff"
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href={role === "staff" ? "/staff/dashboard" : "/user/dashboard"}>
                <img src="/logo.svg" alt="Logo" className="h-6 w-6" />
                <span className="text-base font-semibold">TicketFlow</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={role === "staff" ? navItems.staff : navItems.user} />
        <NavSecondary items={secondaryNavItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
