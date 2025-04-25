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
  TagIcon,
  XIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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
      return "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30"
    case "High":
      return "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30"
    case "Medium":
      return "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30"
    case "Low":
      return "border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30"
    default:
      return ""
  }
}

export function StaffTicketSidebar() {
  const router = useRouter()
  const params = useParams()
  const currentTicketId = params.id as string
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"all" | "grouped" | "pinned" | "starred">("all")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

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

  // Filter tickets based on search query and status filter
  const filteredTickets = sampleTickets.filter(
    (ticket) =>
      (ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.initiator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === null || ticket.status === statusFilter) &&
      (viewMode !== "pinned" || ticket.isPinned) &&
      (viewMode !== "starred" || ticket.isStarred),
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

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter(null)
    setViewMode("all")
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <TagIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold group-data-[collapsible=icon]:hidden">Tickets</h2>
            </div>
            <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="bottom">Previous ticket</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="bottom">Next ticket</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <FilterIcon className="h-4 w-4" />
                        <span className="sr-only">Filter</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Filter tickets</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setViewMode("all")}>
                    <span className="flex-1">All Tickets</span>
                    {viewMode === "all" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("grouped")}>
                    <span className="flex-1">Grouped by Category</span>
                    {viewMode === "grouped" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("pinned")}>
                    <span className="flex-1">Pinned Only</span>
                    {viewMode === "pinned" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("starred")}>
                    <span className="flex-1">Starred Only</span>
                    {viewMode === "starred" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter("Pending")}>
                    <span className="flex-1">Pending Status</span>
                    {statusFilter === "Pending" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("In Progress")}>
                    <span className="flex-1">In Progress</span>
                    {statusFilter === "In Progress" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("Completed")}>
                    <span className="flex-1">Completed</span>
                    {statusFilter === "Completed" && <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={clearFilters}>
                    <XIcon className="mr-2 h-4 w-4" />
                    <span>Clear Filters</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="relative mt-3 group-data-[collapsible=icon]:hidden">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              className="pl-9 pr-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
                onClick={() => setSearchQuery("")}
              >
                <XIcon className="h-3 w-3" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
          {(statusFilter || viewMode !== "all") && (
            <div className="mt-2 flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
              <div className="flex flex-1 flex-wrap gap-1">
                {statusFilter && (
                  <Badge variant="outline" className="flex items-center gap-1 bg-background">
                    Status: {statusFilter}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-3 w-3 rounded-full"
                      onClick={() => setStatusFilter(null)}
                    >
                      <XIcon className="h-2 w-2" />
                      <span className="sr-only">Remove filter</span>
                    </Button>
                  </Badge>
                )}
                {viewMode !== "all" && (
                  <Badge variant="outline" className="flex items-center gap-1 bg-background">
                    View: {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1 h-3 w-3 rounded-full"
                      onClick={() => setViewMode("all")}
                    >
                      <XIcon className="h-2 w-2" />
                      <span className="sr-only">Remove filter</span>
                    </Button>
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-[calc(100vh-124px)]">
            {viewMode === "all" || viewMode === "pinned" || viewMode === "starred" ? (
              <SidebarMenu>
                {sortedTickets.length > 0 ? (
                  sortedTickets.map((ticket) => (
                    <SidebarMenuItem key={ticket.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={ticket.id === currentTicketId}
                        className={`relative ${getPriorityColor(ticket.priority)}`}
                      >
                        <a href={`/staff/tickets/${ticket.id}`} className="group h-fit">
                          <div className="flex w-full flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={ticket.initiator.avatar || "/placeholder.svg"}
                                    alt={ticket.initiator.name}
                                  />
                                  <AvatarFallback>{ticket.initiator.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium line-clamp-1">{ticket.title}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {ticket.isStarred && (
                                  <StarIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                                )}
                                {ticket.isPinned && <PinIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span className="line-clamp-1">{ticket.initiator.name}</span>
                                <span>•</span>
                                <Badge
                                  variant="outline"
                                  className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px] border-none bg-background/50"
                                >
                                  {getStatusIcon(ticket.status)}
                                  <span className="ml-0.5">{ticket.status}</span>
                                </Badge>
                              </div>
                              <span>{formatDate(ticket.updatedAt)}</span>
                            </div>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{ticket.lastMessage}</p>
                          </div>
                          <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-xs"
                                  onClick={(e) => togglePin(ticket.id, e)}
                                >
                                  <PinIcon
                                    className={`h-3 w-3 ${ticket.isPinned ? "text-blue-500" : "text-muted-foreground"}`}
                                  />
                                  <span className="sr-only">{ticket.isPinned ? "Unpin" : "Pin"}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">{ticket.isPinned ? "Unpin" : "Pin"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-xs"
                                  onClick={(e) => toggleStar(ticket.id, e)}
                                >
                                  <StarIcon
                                    className={`h-3 w-3 ${
                                      ticket.isStarred ? "text-amber-500" : "text-muted-foreground"
                                    }`}
                                  />
                                  <span className="sr-only">{ticket.isStarred ? "Unstar" : "Star"}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">{ticket.isStarred ? "Unstar" : "Star"}</TooltipContent>
                            </Tooltip>
                          </div>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <SearchIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No tickets found</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                    </div>
                    {(searchQuery || statusFilter || viewMode !== "all") && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                )}
              </SidebarMenu>
            ) : (
              <div className="space-y-2 p-2">
                {Object.entries(groupedTickets).map(([group, tickets]) => {
                  // Filter tickets in this group
                  const filteredGroupTickets = tickets.filter(
                    (ticket) =>
                      (ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ticket.initiator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        ticket.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (statusFilter === null || ticket.status === statusFilter),
                  )

                  // Skip empty groups
                  if (filteredGroupTickets.length === 0) return null

                  return (
                    <Collapsible key={group} open={expandedGroups[group]} onOpenChange={() => toggleGroup(group)}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 hover:bg-muted">
                        <div className="flex items-center gap-2 font-medium">
                          <span>{group}</span>
                          <Badge variant="secondary" className="ml-1">
                            {filteredGroupTickets.length}
                          </Badge>
                        </div>
                        <ChevronDownIcon
                          className={`h-4 w-4 transition-transform ${expandedGroups[group] ? "rotate-180" : ""}`}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className="ml-2 mt-1 border-l pl-2">
                          {filteredGroupTickets
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
                                  <a href={`/staff/tickets/${ticket.id}`} className="group h-fit">
                                    <div className="flex w-full flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                            <AvatarImage
                                              src={ticket.initiator.avatar || "/placeholder.svg"}
                                              alt={ticket.initiator.name}
                                            />
                                            <AvatarFallback>{ticket.initiator.name.charAt(0)}</AvatarFallback>
                                          </Avatar>
                                          <span className="font-medium line-clamp-1">{ticket.title}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {ticket.isStarred && (
                                            <StarIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                                          )}
                                          {ticket.isPinned && (
                                            <PinIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <span className="line-clamp-1">{ticket.initiator.name}</span>
                                          <span>•</span>
                                          <Badge
                                            variant="outline"
                                            className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px] border-none bg-background/50"
                                          >
                                            {getStatusIcon(ticket.status)}
                                            <span className="ml-0.5">{ticket.status}</span>
                                          </Badge>
                                        </div>
                                        <span>{formatDate(ticket.updatedAt)}</span>
                                      </div>
                                      <p className="line-clamp-2 text-xs text-muted-foreground">{ticket.lastMessage}</p>
                                    </div>
                                    <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-xs"
                                            onClick={(e) => togglePin(ticket.id, e)}
                                          >
                                            <PinIcon
                                              className={`h-3 w-3 ${
                                                ticket.isPinned ? "text-blue-500" : "text-muted-foreground"
                                              }`}
                                            />
                                            <span className="sr-only">{ticket.isPinned ? "Unpin" : "Pin"}</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                          {ticket.isPinned ? "Unpin" : "Pin"}
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-xs"
                                            onClick={(e) => toggleStar(ticket.id, e)}
                                          >
                                            <StarIcon
                                              className={`h-3 w-3 ${
                                                ticket.isStarred ? "text-amber-500" : "text-muted-foreground"
                                              }`}
                                            />
                                            <span className="sr-only">{ticket.isStarred ? "Unstar" : "Star"}</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                          {ticket.isStarred ? "Unstar" : "Star"}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </a>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </SidebarContent>
      </Sidebar>
    </TooltipProvider>
  )
}
