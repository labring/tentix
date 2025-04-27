import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  FilterIcon,
  Loader2Icon,
  PinIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar.tsx"
import { Badge } from "./ui/badge.tsx"
import { Button } from "./ui/button.tsx"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx"
import { Input } from "./ui/input.tsx"
import { ScrollArea } from "./ui/scroll-area.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar.tsx"

// Sample ticket data
const sampleTickets = [
  {
    id: "1",
    title: "Broken AC in Conference Room",
    initiator: {
      name: "John Doe",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "High",
    status: "In Progress",
    lastMessage: "I've assigned Eddie Lake to your ticket. He'll be visiting the conference room today between 2-4 PM.",
    updatedAt: "2024-04-01T11:00:00",
    isPinned: true,
    group: "HVAC",
    isStarred: true,
  },
  {
    id: "2",
    title: "Flickering Lights in Hallway",
    initiator: {
      name: "James Wilson",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "Medium",
    status: "In Progress",
    lastMessage: "The electrician will check the circuit breaker and wiring tomorrow morning.",
    updatedAt: "2024-04-02T14:30:00",
    isPinned: false,
    group: "Electrical",
    isStarred: false,
  },
  {
    id: "3",
    title: "Leaking Faucet in Kitchen",
    initiator: {
      name: "Maria Garcia",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "Low",
    status: "Completed",
    lastMessage: "The plumber has fixed the leak and replaced the washer.",
    updatedAt: "2024-03-29T16:20:00",
    isPinned: false,
    group: "Plumbing",
    isStarred: false,
  },
  {
    id: "4",
    title: "Broken Window in Office 204",
    initiator: {
      name: "Alex Thompson",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "Medium",
    status: "In Progress",
    lastMessage: "The glass replacement has been ordered and will be installed on Friday.",
    updatedAt: "2024-04-03T09:15:00",
    isPinned: false,
    group: "Structural",
    isStarred: true,
  },
  {
    id: "5",
    title: "Network Outage in Marketing Dept",
    initiator: {
      name: "Nina Patel",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "Critical",
    status: "Pending",
    lastMessage: "The entire marketing department is experiencing network connectivity issues.",
    updatedAt: "2024-04-03T08:15:00",
    isPinned: true,
    group: "IT",
    isStarred: false,
  },
  {
    id: "6",
    title: "Clogged Toilet in Men's Restroom",
    initiator: {
      name: "David Kim",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "High",
    status: "Completed",
    lastMessage: "The plumber has cleared the blockage and the toilet is now functioning properly.",
    updatedAt: "2024-04-02T11:30:00",
    isPinned: false,
    group: "Plumbing",
    isStarred: false,
  },
  {
    id: "7",
    title: "Carpet Stain in Reception Area",
    initiator: {
      name: "Priya Singh",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "Low",
    status: "Scheduled",
    lastMessage: "The cleaning service will treat the stain on Monday morning.",
    updatedAt: "2024-04-05T10:00:00",
    isPinned: false,
    group: "Cleaning",
    isStarred: false,
  },
  {
    id: "8",
    title: "Projector Not Working in Room 305",
    initiator: {
      name: "Carlos Rodriguez",
      avatar: "/avatars/shadcn.jpg",
    },
    priority: "Medium",
    status: "In Progress",
    lastMessage: "The IT technician is troubleshooting the connection issue.",
    updatedAt: "2024-04-04T13:45:00",
    isPinned: false,
    group: "IT",
    isStarred: false,
  },
]

// Group tickets by their group property
const groupedTickets = sampleTickets.reduce(
  (acc, ticket) => {
    if (!acc[ticket.group]) {
      acc[ticket.group] = []
    }
    acc[ticket.group].push(ticket)
    return acc
  },
  {} as Record<string, typeof sampleTickets>,
)

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
    case "Critical":
      return "bg-red-50 dark:bg-red-950/50"
    case "High":
      return "bg-orange-50 dark:bg-orange-950/50"
    case "Medium":
      return "bg-amber-50 dark:bg-amber-950/50"
    case "Low":
      return "bg-green-50 dark:bg-green-950/50"
    default:
      return ""
  }
}

export function StaffTicketSidebar() {
  const router = useRouter()
  const params = useParams()
  const currentTicketId = params.id as string
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"all" | "grouped">("all")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Initialize expanded groups
  useEffect(() => {
    const initialExpandedGroups = Object.keys(groupedTickets).reduce(
      (acc, group) => {
        acc[group] = true
        return acc
      },
      {} as Record<string, boolean>,
    )
    setExpandedGroups(initialExpandedGroups)
  }, [])

  // Filter tickets based on search query
  const filteredTickets = sampleTickets.filter(
    (ticket) =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.initiator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Sort tickets: pinned first, then by updated time
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  // Find the index of the current ticket
  const currentTicketIndex = sortedTickets.findIndex((ticket) => ticket.id === currentTicketId)

  // Navigate to previous ticket
  const goToPreviousTicket = () => {
    if (currentTicketIndex > 0) {
      const prevTicket = sortedTickets[currentTicketIndex - 1]
      router.push(`/staff/tickets/${prevTicket.id}`)
    }
  }

  // Navigate to next ticket
  const goToNextTicket = () => {
    if (currentTicketIndex < sortedTickets.length - 1) {
      const nextTicket = sortedTickets[currentTicketIndex + 1]
      router.push(`/staff/tickets/${nextTicket.id}`)
    }
  }

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }))
  }

  // Toggle pin status
  const togglePin = (ticketId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    // In a real app, you would update this in your database
    console.log(`Toggling pin for ticket ${ticketId}`)
  }

  // Toggle star status
  const toggleStar = (ticketId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    // In a real app, you would update this in your database
    console.log(`Toggling star for ticket ${ticketId}`)
  }

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tickets</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousTicket}
              disabled={currentTicketIndex <= 0}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="sr-only">Previous ticket</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextTicket}
              disabled={currentTicketIndex >= sortedTickets.length - 1}
            >
              <ArrowRightIcon className="h-4 w-4" />
              <span className="sr-only">Next ticket</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <FilterIcon className="h-4 w-4" />
                  <span className="sr-only">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewMode("all")}>All Tickets</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode("grouped")}>Grouped by Category</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Show Pinned Only</DropdownMenuItem>
                <DropdownMenuItem>Show Starred Only</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>High Priority Only</DropdownMenuItem>
                <DropdownMenuItem>Pending Status Only</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="relative mt-2">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-180px)]">
          {viewMode === "all" ? (
            <SidebarMenu>
              {sortedTickets.map((ticket) => (
                <SidebarMenuItem key={ticket.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={ticket.id === currentTicketId}
                    className={`relative ${getPriorityColor(ticket.priority)}`}
                  >
                    <a href={`/staff/tickets/${ticket.id}`} className="group">
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={ticket.initiator.avatar} alt={ticket.initiator.name} />
                              <AvatarFallback>{ticket.initiator.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{ticket.title}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {ticket.isStarred && <StarIcon className="h-4 w-4 text-amber-500" />}
                            {ticket.isPinned && <PinIcon className="h-4 w-4 text-blue-500" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span>{ticket.initiator.name}</span>
                            <span>•</span>
                            <Badge variant="outline" className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]">
                              {getStatusIcon(ticket.status)}
                              {ticket.status}
                            </Badge>
                          </div>
                          <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{ticket.lastMessage}</p>
                      </div>
                      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => togglePin(ticket.id, e)}
                        >
                          <PinIcon
                            className={`h-3 w-3 ${ticket.isPinned ? "text-blue-500" : "text-muted-foreground"}`}
                          />
                          <span className="sr-only">{ticket.isPinned ? "Unpin" : "Pin"}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => toggleStar(ticket.id, e)}
                        >
                          <StarIcon
                            className={`h-3 w-3 ${ticket.isStarred ? "text-amber-500" : "text-muted-foreground"}`}
                          />
                          <span className="sr-only">{ticket.isStarred ? "Unstar" : "Star"}</span>
                        </Button>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          ) : (
            <div className="space-y-2 p-2">
              {Object.entries(groupedTickets).map(([group, tickets]) => (
                <Collapsible key={group} open={expandedGroups[group]} onOpenChange={() => toggleGroup(group)}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 hover:bg-muted">
                    <div className="flex items-center gap-2 font-medium">
                      {group}
                      <Badge variant="secondary" className="ml-2">
                        {tickets.length}
                      </Badge>
                    </div>
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${expandedGroups[group] ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="ml-2 mt-1 border-l pl-2">
                      {tickets
                        .filter(
                          (ticket) =>
                            ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            ticket.initiator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            ticket.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .sort((a, b) => {
                          if (a.isPinned && !b.isPinned) return -1
                          if (!a.isPinned && b.isPinned) return 1
                          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                        })
                        .map((ticket) => (
                          <SidebarMenuItem key={ticket.id}>
                            <SidebarMenuButton
                              asChild
                              isActive={ticket.id === currentTicketId}
                              className={`relative ${getPriorityColor(ticket.priority)}`}
                            >
                              <a href={`/staff/tickets/${ticket.id}`} className="group">
                                <div className="flex w-full flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{ticket.title}</span>
                                    <div className="flex items-center gap-1">
                                      {ticket.isStarred && <StarIcon className="h-4 w-4 text-amber-500" />}
                                      {ticket.isPinned && <PinIcon className="h-4 w-4 text-blue-500" />}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <Badge
                                      variant="outline"
                                      className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]"
                                    >
                                      {getStatusIcon(ticket.status)}
                                      {ticket.status}
                                    </Badge>
                                    <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => togglePin(ticket.id, e)}
                                  >
                                    <PinIcon
                                      className={`h-3 w-3 ${ticket.isPinned ? "text-blue-500" : "text-muted-foreground"}`}
                                    />
                                    <span className="sr-only">{ticket.isPinned ? "Unpin" : "Pin"}</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => toggleStar(ticket.id, e)}
                                  >
                                    <StarIcon
                                      className={`h-3 w-3 ${ticket.isStarred ? "text-amber-500" : "text-muted-foreground"}`}
                                    />
                                    <span className="sr-only">{ticket.isStarred ? "Unstar" : "Star"}</span>
                                  </Button>
                                </div>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{sortedTickets.length} tickets</div>
          <Button variant="outline" size="sm">
            Create Ticket
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
