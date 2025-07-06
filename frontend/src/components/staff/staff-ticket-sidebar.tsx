import { Link, useNavigate } from "@tanstack/react-router";
import { joinTrans, useTranslation } from "i18n";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  FilterIcon,
  PinIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type TicketsListItemType } from "tentix-server/rpc";
import {
  Avatar, AvatarFallback, AvatarImage, Badge, Button, Collapsible,
  CollapsibleContent,
  CollapsibleTrigger, DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger, Input, ScrollArea,
} from "tentix-ui";
import { useTicketFavorites } from "../../store/ticket-favorites.ts";
import useLocalUser from "@hook/use-local-user";

function groupTickets<T extends Record<string, unknown>>(
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

function getStatusDisplay(status: string) {
  switch (status) {
    case "pending":
    case "scheduled":
      return {
        label: "Pending",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      };
    case "in_progress":
      return {
        label: "In Progress",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      };
    case "resolved":
      return {
        label: "Resolved",
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      };
    default:
      return {
        label: status,
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
      };
  }
}

function timeAgo(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${diffInDays}d ago`;
}

type TicketItemProps = {
  ticket: TicketsListItemType;
  currentTicketId: string;
  isUnread?: boolean;
};

const TicketItem = ({ 
  ticket, 
  currentTicketId,
  isUnread = false,
}: TicketItemProps) => {
  const {
    isStarred,
    isPinned,
    toggleStarred,
    togglePinned,
  } = useTicketFavorites();
  
  const isSelected = ticket.id === currentTicketId;
  const statusDisplay = getStatusDisplay(ticket.status);

  return (
    <Link
      to='/staff/tickets/$id'
      params={{ id: ticket.id }}
      className={`
        group relative block w-full rounded-[8px] border border-zinc-200 p-4 transition-all
        ${getPriorityColor(ticket.priority)}
        ${isSelected ? "bg-zinc-100" : "hover:bg-zinc-50"}
      `}
    >
      {/* Unread indicator */}
      {isUnread && !isSelected && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
      )}

      {/* Header with Avatar and Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage
              src={ticket.customer.avatar || "/placeholder.svg"}
              alt={ticket.customer.nickname || ""}
            />
            <AvatarFallback>
              {ticket.customer.nickname?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold text-zinc-900 leading-5 line-clamp-1">
            {ticket.title}
          </span>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {isStarred(ticket.id) && (
            <StarIcon className="h-4 w-4 text-amber-500" />
          )}
          {isPinned(ticket.id) && (
            <PinIcon className="h-4 w-4 text-blue-500" />
          )}
          <div className="hidden group-hover:flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.preventDefault();
                togglePinned(ticket.id);
              }}
            >
              <PinIcon
                className={`h-3 w-3 ${isPinned(ticket.id) ? "text-blue-500" : "text-muted-foreground"}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.preventDefault();
                toggleStarred(ticket.id);
              }}
            >
              <StarIcon
                className={`h-3 w-3 ${
                  isStarred(ticket.id)
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Divider line */}
      <div className="h-[0.8px] bg-zinc-200 w-full mb-3"></div>

      {/* Customer and Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-normal text-[#3F3F46] leading-4">
            {ticket.customer.nickname || "Unknown"}
          </span>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
            {statusDisplay.label}
          </span>
        </div>
        <span className="text-xs font-normal text-[#3F3F46] leading-4">
          {timeAgo(ticket.updatedAt)}
        </span>
      </div>

      {/* Last Message */}
      {ticket.messages.at(-1)?.content && (
        <p className="text-xs font-normal text-[#3F3F46] leading-4 line-clamp-2">
          {ticket.messages.at(-1)?.content}
        </p>
      )}
    </Link>
  );
};

export function StaffTicketSidebar({
  tickets = [],
  currentTicketId,
  isCollapsed,
}: {
  tickets?: TicketsListItemType[];
  currentTicketId: string;
  isCollapsed?: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: userId } = useLocalUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<
    "all" | "grouped" | "pinned" | "starred"
  >("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const {
    isStarred,
    isPinned,
    expandedGroups,
    setExpandedGroups,
    toggleGroup,
  } = useTicketFavorites();

  // Check if a ticket is unread
  const isTicketUnread = (ticket: TicketsListItemType) => {
    // 如果没有任何消息，则不算未读
    if (!ticket.messages || ticket.messages.length === 0) {
      return false;
    }
    
    const lastMessage = ticket.messages.at(-1);
    if (!lastMessage) {
      return false;
    }
    
    // 如果最后一条消息是自己发送的，则不算未读
    if (lastMessage.senderId === userId) {
      return false;
    }
    
    // 如果没有 readStatus，则算未读
    if (!lastMessage.readStatus) {
      return true;
    }
    
    // 如果 readStatus 中有自己的记录，则不算未读
    return !lastMessage.readStatus.some((status) => status.userId === userId);
  };

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

  // Filter tickets based on search query, status filter, and unread status
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
        (viewMode !== "starred" || isStarred(ticket.id)) &&
        (!showUnreadOnly || isTicketUnread(ticket)),
    );
  }, [tickets, searchQuery, statusFilter, viewMode, showUnreadOnly, isTicketUnread]);

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
    setShowUnreadOnly(false);
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
      {(searchQuery || statusFilter || viewMode !== "all" || showUnreadOnly) && (
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
    <div
      className={`w-75 h-full border-r bg-white transition-all duration-300 flex-col ${isCollapsed ? "hidden" : "hidden xl:flex"}`}
    >
      {/* Header - fixed height */}
      <div className="flex h-14 px-4 items-center gap-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <h2 className="text-sm font-semibold leading-none text-black">
            {t("tkt_other")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToPreviousTicket}
            disabled={currentTicketIndex <= 0}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToNextTicket}
            disabled={currentTicketIndex >= sortedTickets.length - 1}
          >
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <FilterIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setViewMode("all")}>
                <span className="flex-1">{joinTrans([t("all"), t("tkt_other")])}</span>
                {viewMode === "all" && (
                  <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
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
              <DropdownMenuItem onClick={() => setShowUnreadOnly(!showUnreadOnly)}>
                <span className="flex-1">{t("unread")} Only</span>
                {showUnreadOnly && (
                  <CheckCircleIcon className="ml-2 h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
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
                onClick={() => setStatusFilter("resolved")}
              >
                <span className="flex-1">Resolved</span>
                {statusFilter === "resolved" && (
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

      {/* Search and Filters - fixed height */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 flex-shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-11 pr-3 text-sm leading-none h-10 rounded-[8px]"
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
            </Button>
          )}
        </div>

        {(statusFilter || viewMode !== "all" || showUnreadOnly) && (
          <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs">
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
                  </Button>
                </Badge>
              )}
              {showUnreadOnly && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 bg-background"
                >
                  {t("unread")} Only
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 h-3 w-3 rounded-full"
                    onClick={() => setShowUnreadOnly(false)}
                  >
                    <XIcon className="h-2 w-2" />
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
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="flex flex-col items-center gap-4 p-4">
            {viewMode === "all" || viewMode === "pinned" || viewMode === "starred" ? (
              <>
                {sortedTickets.length > 0 ? (
                  sortedTickets.map((ticket) => (
                    <TicketItem
                      key={ticket.id}
                      ticket={ticket}
                      currentTicketId={currentTicketId}
                      isUnread={isTicketUnread(ticket)}
                    />
                  ))
                ) : renderEmptyState()}
              </>
            ) : (
              <div className="space-y-2 w-full">
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
                      (statusFilter === null || ticket.status === statusFilter) &&
                      (!showUnreadOnly || isTicketUnread(ticket)),
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
                        <div className="ml-2 mt-1 border-l pl-2 space-y-4">
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
                                isUnread={isTicketUnread(ticket)}
                              />
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
