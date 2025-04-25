import { useState } from "react"
import { useParams } from "next/navigation"
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
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
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <h2 className="text-lg font-semibold">My Tickets</h2>
        <div className="relative mt-2">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mt-2 flex gap-2">
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
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <SidebarMenu>
            {sortedTickets.map((ticket) => (
              <SidebarMenuItem key={ticket.id}>
                <SidebarMenuButton asChild isActive={ticket.id === currentTicketId}>
                  <a href={`/user/tickets/${ticket.id}`} className="relative">
                    <div className="flex w-full flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ticket.title}</span>
                        {ticket.hasUnreadMessages && <Badge className="bg-primary px-1.5 text-[10px]">New</Badge>}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline" className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]">
                          {getStatusIcon(ticket.status)}
                          {ticket.status}
                        </Badge>
                        <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{ticket.category}</span>
                        <span>•</span>
                        <span>{ticket.priority} Priority</span>
                      </div>
                    </div>
                    {ticket.hasUnreadMessages && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <MessageSquareIcon className="h-3 w-3" />
                        </div>
                      </div>
                    )}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Button className="w-full gap-1.5" asChild>
          <a href="/user/tickets/create">
            <PlusIcon className="h-4 w-4" />
            Create New Ticket
          </a>
        </Button>
        <Button variant="outline" className="mt-2 w-full gap-1.5" asChild>
          <a href="/user/tickets">
            <FileTextIcon className="h-4 w-4" />
            View All Tickets
          </a>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
