import { useState } from "react"
import { useParams } from "next/navigation"
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  TicketIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Sample ticket data for user
const userTickets = [
  {
    id: "1",
    title: "Broken AC in Conference Room",
    status: "In Progress",
    priority: "High",
    category: "HVAC",
    createdAt: "2024-04-01T09:30:00",
    updatedAt: "2024-04-01T11:00:00",
    hasUnreadMessages: true,
  },
  {
    id: "2",
    title: "Flickering Lights in Hallway",
    status: "In Progress",
    priority: "Medium",
    category: "Electrical",
    createdAt: "2024-04-02T11:15:00",
    updatedAt: "2024-04-02T14:30:00",
    hasUnreadMessages: false,
  },
  {
    id: "3",
    title: "Leaking Faucet in Kitchen",
    status: "Completed",
    priority: "Low",
    category: "Plumbing",
    createdAt: "2024-03-28T14:45:00",
    updatedAt: "2024-03-29T16:20:00",
    hasUnreadMessages: false,
  },
  {
    id: "4",
    title: "Broken Window in Office 204",
    status: "In Progress",
    priority: "Medium",
    category: "Structural",
    createdAt: "2024-04-01T10:00:00",
    updatedAt: "2024-04-03T09:15:00",
    hasUnreadMessages: true,
  },
]

function getStatusIcon(status: string) {
  switch (status) {
    case "Completed":
      return <CheckCircleIcon className="text-green-500 dark:text-green-400" />
    case "In Progress":
      return <Loader2Icon className="text-amber-500 dark:text-amber-400" />
    case "Pending":
      return <ClockIcon className="text-blue-500 dark:text-blue-400" />
    case "Scheduled":
      return <ClockIcon className="text-purple-500 dark:text-purple-400" />
    default:
      return <AlertTriangleIcon className="text-red-500 dark:text-red-400" />
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "Medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Low":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  }
}

export function UserTicketSidebar() {
  const params = useParams()
  const currentTicketId = params.id as string
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all")

  // Filter tickets based on search query and filter
  const filteredTickets = userTickets.filter(
    (ticket) =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" && ticket.status !== "Completed") ||
        (filter === "completed" && ticket.status === "Completed")),
  )

  // Sort tickets by updated time
  const sortedTickets = [...filteredTickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold group-data-[collapsible=icon]:hidden">My Tickets</h2>
          </div>
          <div className="relative group-data-[collapsible=icon]:hidden">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 group-data-[collapsible=icon]:hidden">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilter("completed")}
            >
              Completed
            </Button>
          </div>
          {/* Collapsed state search button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="hidden group-data-[collapsible=icon]:flex"
                onClick={() => {}}
              >
                <SearchIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Search tickets</TooltipContent>
          </Tooltip>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-[calc(100vh-220px)]">
            <SidebarMenu>
              {sortedTickets.map((ticket) => (
                <SidebarMenuItem key={ticket.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={ticket.id === currentTicketId} tooltip={ticket.title}>
                        <a href={`/user/tickets/${ticket.id}`} className="relative h-fit">
                          <div className="flex w-full flex-col gap-1">
                            {/* Icon for collapsed state */}
                            <div className="hidden group-data-[collapsible=icon]:block">
                              {getStatusIcon(ticket.status)}
                            </div>

                            {/* Content for expanded state */}
                            <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
                              <span className="font-medium line-clamp-1">{ticket.title}</span>
                              {ticket.hasUnreadMessages && (
                                <Badge className="ml-1 shrink-0 bg-primary px-1.5 text-[10px]">New</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                              <Badge variant="outline" className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]">
                                {getStatusIcon(ticket.status)}
                                {ticket.status}
                              </Badge>
                              <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                              <span className="line-clamp-1">{ticket.category}</span>
                              <span>•</span>
                              <span
                                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${getPriorityColor(ticket.priority)}`}
                              >
                                {ticket.priority}
                              </span>
                            </div>
                          </div>

                          {/* Notification indicator (works in both states) */}
                          {ticket.hasUnreadMessages && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 group-data-[collapsible=icon]:right-0">
                              <div className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary" />
                            </div>
                          )}
                        </a>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] space-y-1 p-3">
                      <div className="font-medium">{ticket.title}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]">
                          {getStatusIcon(ticket.status)}
                          {ticket.status}
                        </Badge>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${getPriorityColor(ticket.priority)}`}
                        >
                          {ticket.priority}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ticket.category} • Updated {new Date(ticket.updatedAt).toLocaleDateString()}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full gap-1.5 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                asChild
              >
                <a href="/user/tickets/create">
                  <PlusIcon className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Create New Ticket</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
              Create New Ticket
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="mt-2 w-full gap-1.5 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:mt-2"
                asChild
              >
                <a href="/user/tickets">
                  <FileTextIcon className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">View All Tickets</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
              View All Tickets
            </TooltipContent>
          </Tooltip>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  )
}
