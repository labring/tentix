import type React from "react"

import {
  ArrowUpCircleIcon,
  BuildingIcon,
  ClipboardListIcon,
  ClockIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  PlusCircleIcon,
  SearchIcon,
  SettingsIcon,
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
    name: "John Doe",
    email: "john@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
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
      title: "Create Ticket",
      url: "/user/tickets/create",
      icon: PlusCircleIcon,
    },
    {
      title: "Ticket History",
      url: "/user/history",
      icon: ClockIcon,
    },
  ],
  navLocations: [
    {
      name: "Building A",
      url: "#",
      icon: BuildingIcon,
    },
    {
      name: "Building B",
      url: "#",
      icon: BuildingIcon,
    },
    {
      name: "Building C",
      url: "#",
      icon: BuildingIcon,
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

export function UserSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href="/user/dashboard">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">TicketFlow</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.navLocations} title="Locations" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
