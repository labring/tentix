import type React from "react"

import {
  ArrowUpCircleIcon,
  BarChartIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CogIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  PenToolIcon as ToolIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"

import { NavDocuments } from "./nav-documents"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin User",
    email: "admin@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
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
      title: "Assignments",
      url: "/staff/assignments",
      icon: ClipboardCheckIcon,
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
  ],
  navCategories: [
    {
      name: "Electrical",
      url: "#",
      icon: ToolIcon,
    },
    {
      name: "Plumbing",
      url: "#",
      icon: WrenchIcon,
    },
    {
      name: "HVAC",
      url: "#",
      icon: ToolIcon,
    },
    {
      name: "IT",
      url: "#",
      icon: CogIcon,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: SettingsIcon,
    },
    {
      title: "Get Help",
      url: "#",
      icon: HelpCircleIcon,
    },
    {
      title: "Search",
      url: "#",
      icon: SearchIcon,
    },
  ],
}

export function StaffSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href="/staff/dashboard">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">TicketFlow</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.navCategories} title="Categories" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
