import type React from "react";
import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "tentix-ui";
import { Badge } from "tentix-ui";
import { Button } from "tentix-ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "tentix-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "tentix-ui";
import { Input } from "tentix-ui";
import { ScrollArea } from "tentix-ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "tentix-ui";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "tentix-ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTicketFavorites } from "../../store/ticket-favorites.ts";
import { joinTrans, useTranslation } from "i18n";
import { StatusBadge } from "tentix-ui";
import { timeAgo } from "tentix-ui";
import { type TicketsListItemType } from "tentix-server/rpc";

export function groupTickets<T extends Record<string, unknown>>(
  tickets: T[] | undefined = [],
  groupBy: keyof T = "group" as keyof T,
): Record<string, T[]> {
  if (!tickets || !Array.isArray(tickets)) {
    return {};
  }
  
  return tickets.reduce(
    (acc, ticket) => {
      // Use ticket[groupBy] as the group name, if not, use 'Uncategorized'
      const groupName =
        (ticket[groupBy] as unknown as string) || "Uncategorized";

      if (!acc[groupName]) {
        acc[groupName] = [];
      }

      acc[groupName].push(ticket);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Completed":
      return <CheckCircleIcon className="text-green-500 dark:text-green-400" />;
    case "In Progress":
      return <Loader2Icon className="text-amber-500 dark:text-amber-400" />;
    case "Pending":
      return <ClockIcon className="text-blue-500 dark:text-blue-400" />;
    case "Scheduled":
      return <ClockIcon className="text-purple-500 dark:text-purple-400" />;
    default:
      return <AlertTriangleIcon className="text-red-500 dark:text-red-400" />;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "Critical":
      return "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30";
    case "High":
      return "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30";
    case "Medium":
      return "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30";
    case "Low":
      return "border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30";
    default:
      return "";
  }
}



type TicketItemProps = {
  ticket: TicketsListItemType;
  currentTicketId: string;
};

const TicketItem = ({ 
  ticket, 
  currentTicketId, 
}: TicketItemProps) => {
  const {
    isStarred,
    isPinned,
    toggleStarred,
    togglePinned,
  } = useTicketFavorites();
  return (
    <SidebarMenuItem key={ticket.id}>
      <SidebarMenuButton
        asChild
        isActive={ticket.id === currentTicketId}
        className={`relative ${getPriorityColor(ticket.priority)}`}
      >
        <Link to='/staff/tickets/$id' params={{ id: ticket.id }} className="group h-fit">
          <div className="flex w-full flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={ticket.customer.avatar || "/placeholder.svg"}
                    alt={ticket.customer.nickname || ""}
                  />
                  <AvatarFallback>
                    {ticket.customer.nickname.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium line-clamp-1">{ticket.title}</span>
              </div>
              <div className="items-center gap-1 group-data-[collapsible=icon]:flex hidden">
                {isStarred(ticket.id) && (
                  <StarIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                )}
                {isPinned(ticket.id) && (
                  <PinIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="line-clamp-1">
                  {ticket.customer.nickname || "Unknown"}
                </span>
                <span>•</span>
                <StatusBadge status={ticket.status} />
              </div>
              <span>{timeAgo(ticket.updatedAt)}</span>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {ticket.messages.at(-1)?.content}
            </p>
          </div>
          <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex group-data-[collapsible=icon]:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-xs"
                  onClick={(e) => togglePinned(ticket.id)}
                >
                  <PinIcon
                    className={`h-3 w-3 ${isPinned(ticket.id) ? "text-blue-500" : "text-muted-foreground"}`}
                  />
                  <span className="sr-only">
                    {isPinned(ticket.id) ? "Unpin" : "Pin"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isPinned(ticket.id) ? "Unpin" : "Pin"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-xs"
                  onClick={(e) => toggleStarred(ticket.id)}
                >
                  <StarIcon
                    className={`h-3 w-3 ${
                      isStarred(ticket.id)
                        ? "text-amber-500"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span className="sr-only">
                    {isStarred(ticket.id) ? "Unstar" : "Star"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isStarred(ticket.id) ? "Unstar" : "Star"}
              </TooltipContent>
            </Tooltip>
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export function StaffTicketSidebar({
  tickets = [],
  currentTicketId,
}: {
  tickets?: TicketsListItemType[];
  currentTicketId: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<
    "all" | "grouped" | "pinned" | "starred"
  >("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);


  const {
    isStarred,
    isPinned,
    expandedGroups,
    setExpandedGroups,
    toggleGroup,
  } = useTicketFavorites();

  // Group tickets by group - with safeguards
  const groupedTickets = useMemo(() => 
    groupTickets(tickets), 
    [tickets]
  );

  // Initialize expanded groups
  useEffect(() => {
    if (Object.keys(expandedGroups).length === 0 && Object.keys(groupedTickets).length > 0) {
      const initialExpandedGroups = Object.keys(groupedTickets).reduce(
        (acc, group) => {
          acc[group] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      );
      setExpandedGroups(initialExpandedGroups);
    }
  }, [groupedTickets, expandedGroups, setExpandedGroups]);

  // Filter tickets based on search query and status filter
  const filteredTickets = useMemo(() => {
    if (!tickets || !Array.isArray(tickets)) return [];
    
    return tickets.filter(
      (ticket) =>
        (ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.customer?.nickname
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          JSON.stringify(ticket.messages.at(-1)?.content)
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())) &&
        (statusFilter === null || ticket.status === statusFilter) &&
        (viewMode !== "pinned" || isPinned(ticket.id)) &&
        (viewMode !== "starred" || isStarred(ticket.id)),
    );
  }, [tickets, searchQuery, statusFilter, viewMode]);

  // Sort tickets: pinned first, then by updated time
  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      if (isPinned(a.id) && !isPinned(b.id)) return -1;
      if (!isPinned(a.id) && isPinned(b.id)) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filteredTickets, isPinned]);

  // Find the index of the current ticket
  const currentTicketIndex = useMemo(() => 
    sortedTickets.findIndex((ticket) => ticket.id === currentTicketId),
    [sortedTickets, currentTicketId]
  );

  // Navigate to previous ticket
  const goToPreviousTicket = () => {
    if (currentTicketIndex > 0) {
      const prevTicket = sortedTickets[currentTicketIndex - 1]?.id ?? null;
      if (prevTicket) {
        navigate({ to: `/staff/tickets/${prevTicket}` });
      }
    }
  };

  // Navigate to next ticket
  const goToNextTicket = () => {
    if (currentTicketIndex < sortedTickets.length - 1) {
      const nextTicket = sortedTickets[currentTicketIndex + 1]?.id ?? null;
      if (nextTicket) {
        navigate({ to: `/staff/tickets/${nextTicket}` });
      }
    }
  };


  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setViewMode("all");
  };

  const renderEmptyState = () => (
    <div className="flex h-32 flex-col items-center justify-center gap-2 p-4 text-center">
      <div className="rounded-full bg-muted p-3">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{t("no_sth_found", { sth: "工单" })}</p>
        <p className="text-sm text-muted-foreground">
          {t("try_adjust_filters")}
        </p>
      </div>
      {(searchQuery || statusFilter || viewMode !== "all") && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={clearFilters}
        >
          Clear Filters
        </Button>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <TagIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
                {t("tkt_other")}
              </h2>
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
                        <span className="sr-only">{t("filter")}</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{joinTrans([t("filter"), t("tkt_other")])}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setViewMode("all")}>
                    <span className="flex-1">{joinTrans([t("all"), t("tkt_other")])}</span>
                    {viewMode === "all" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  {/* <DropdownMenuItem onClick={() => setViewMode("grouped")}>
                    <span className="flex-1">Grouped by Category</span>
                    {viewMode === "grouped" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={() => setViewMode("pinned")}>
                    <span className="flex-1">Pinned Only</span>
                    {viewMode === "pinned" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("starred")}>
                    <span className="flex-1">Starred Only</span>
                    {viewMode === "starred" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter("Pending")}>
                    <span className="flex-1">Pending Status</span>
                    {statusFilter === "pending" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setStatusFilter("in_progress")}
                  >
                    <span className="flex-1">In Progress</span>
                    {statusFilter === "in_progress" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setStatusFilter("Completed")}
                  >
                    <span className="flex-1">Completed</span>
                    {statusFilter === "completed" && (
                      <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                    )}
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
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 bg-background"
                  >
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
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 bg-background"
                  >
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
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={clearFilters}
              >
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
                    <TicketItem
                      key={ticket.id}
                      ticket={ticket}
                      currentTicketId={currentTicketId}
                    />
                  ))
                ) : renderEmptyState()}
              </SidebarMenu>
            ) : (
              <div className="space-y-2 p-2">
                {Object.entries(groupedTickets).map(([group, groupTickets]) => {
                  // Filter tickets in this group
                  const filteredGroupTickets = groupTickets.filter(
                    (ticket) =>
                      (ticket.title
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                        ticket.customer?.nickname
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        JSON.stringify(ticket.messages.at(-1)?.content)
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase())) &&
                      (statusFilter === null || ticket.status === statusFilter),
                  );

                  // Skip empty groups
                  if (filteredGroupTickets.length === 0) return null;

                  return (
                    <Collapsible
                      key={group}
                      open={expandedGroups[group] ?? true}
                      onOpenChange={() => toggleGroup(group)}
                    >
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
                              if (isPinned(a.id) && !isPinned(b.id)) return -1;
                              if (!isPinned(a.id) && isPinned(b.id)) return 1;
                              return (
                                new Date(b.updatedAt).getTime() -
                                new Date(a.updatedAt).getTime()
                              );
                            })
                            .map((ticket) => (
                              <TicketItem
                                key={ticket.id}
                                ticket={ticket}
                                currentTicketId={currentTicketId}
                              />
                            ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SidebarContent>
      </Sidebar>
    </TooltipProvider>
  );
}
