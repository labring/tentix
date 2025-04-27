import React from "react"
import {
  ArrowUpCircleIcon,
  BarChartIcon,
  BookIcon,
  BuildingIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  ClockIcon,
  CogIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  PlusCircleIcon,
  SearchIcon,
  SettingsIcon,
  PenToolIcon as ToolIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react"

import { NavDocuments } from "./nav-documents.tsx"
import { NavMain } from "./nav-main.tsx"
import { NavSecondary } from "./nav-secondary.tsx"
import { NavUser } from "./nav-user.tsx"
import { RoleToggle } from "./role-toggle.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar.tsx"

const data = {
  user: {
    name: "John Doe",
    email: "john@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMainUser: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      title: "My Requests",
      url: "#",
      icon: ClipboardListIcon,
    },
    {
      title: "Submit Request",
      url: "#",
      icon: PlusCircleIcon,
    },
    {
      title: "Request History",
      url: "#",
      icon: ClockIcon,
    },
  ],
  navMainStaff: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Work Orders",
      url: "#",
      icon: ClipboardListIcon,
    },
    {
      title: "Assignments",
      url: "#",
      icon: ClipboardCheckIcon,
    },
    {
      title: "Analytics",
      url: "#",
      icon: BarChartIcon,
    },
    {
      title: "Team",
      url: "#",
      icon: UsersIcon,
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
  navDocs: [
    {
      name: "User Guide",
      url: "/docs/user-guide",
      icon: BookIcon,
    },
    {
      name: "API Reference",
      url: "/docs/api",
      icon: BookIcon,
    },
    {
      name: "Solutions",
      url: "/docs/solutions",
      icon: BookIcon,
    },
    {
      name: "FAQs",
      url: "/docs/faqs",
      icon: BookIcon,
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

// Define the props interface with the onRoleChange prop
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onRoleChange?: (role: "user" | "staff") => void
}

export function AppSidebar({ onRoleChange, ...props }: AppSidebarProps) {
  const [role, setRole] = React.useState<"user" | "staff">("user")

  // Handle role changes and propagate to parent component if onRoleChange is provided
  const handleRoleChange = (newRole: "user" | "staff") => {
    setRole(newRole)
    if (onRoleChange) {
      onRoleChange(newRole)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href="#">
                <ArrowUpCircleIcon className="h-5 w-5" />
                <span className="text-base font-semibold">WorkFlow</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <RoleToggle role={role} onRoleChange={handleRoleChange} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={role === "user" ? data.navMainUser : data.navMainStaff} />
        <NavDocuments
          items={role === "user" ? data.navLocations : data.navCategories}
          title={role === "user" ? "Locations" : "Categories"}
        />
        <NavDocuments items={data.navDocs} title="Documentation" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
