import { useState } from "react"
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

import { Badge } from "../ui/badge.tsx"
import { Button } from "../ui/button.tsx"
import { Input } from "../ui/input.tsx"
import { ScrollArea } from "../ui/scroll-area.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar.tsx"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.tsx"
import { apiClient, InferResponseType } from "../../lib/utils.ts"
import { Link } from "@tanstack/react-router"
import { joinTrans, useTranslation } from "i18n"
import { StatusBadge } from "../basic/index.tsx"
import { TicketsListItemType } from "tentix-ui/lib/types"


function getPriorityColor(priority: TicketsListItemType["priority"]) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  }
}


export function UserTicketSidebar({ data, currentTicketId }: { data: InferResponseType<typeof apiClient.user.getUserTickets.$get>["data"], currentTicketId: number }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all")
  const { t } = useTranslation();
  const {
    state,
    open,
    setOpen,
  } = useSidebar()

  // Filter tickets based on search query and filter
  const filteredTickets = data?.filter(
    (ticket) =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" && ticket.status !== "resolved") ||
        (filter === "completed" && ticket.status === "resolved")),
  ) || []


  // Sort tickets by updated time
  const sortedTickets = [...filteredTickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )


  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="flex flex-col gap-3 items-center">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold group-data-[collapsible=icon]:hidden">{joinTrans([t("my"), t("tkt_other")])}</h2>
          </div>
          <div className="relative group-data-[collapsible=icon]:hidden">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={joinTrans([t("search"), t("tkt_other")])}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 group-data-[collapsible=icon]:hidden uppercase">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilter("all")}
            >
              {joinTrans([t("all"), t("tkt_other")])}
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilter("active")}
            >
              {joinTrans([t("active")])}
            </Button>
            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilter("completed")}
            >
              {joinTrans([t("completed")])}
            </Button>
          </div>
          {/* Collapsed state search button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="hidden group-data-[collapsible=icon]:flex w-8 h-8"
                onClick={() => setOpen(true)}
              >
                <SearchIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{joinTrans([t("search"), t("tkt_other")])}</TooltipContent>
          </Tooltip>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-[calc(100vh-220px)]">
            <SidebarMenu>
              {sortedTickets.map((ticket) => (
                <SidebarMenuItem key={ticket.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={ticket.id === Number(currentTicketId)} tooltip={ticket.title}>
                        <Link to={`/user/tickets/${ticket.id}`} className="relative h-fit w-fit" >
                          <div className="flex w-full flex-col gap-1">
                            {/* Icon for collapsed state */}
                            <div className={`hidden group-data-[collapsible=icon]:block rounded-md w-7 h-7 ${getPriorityColor(ticket.priority)}`}>
                              {ticket.title.slice(0, 2)}
                            </div>

                            {/* Content for expanded state */}
                            <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
                              <span className="font-medium line-clamp-1">{ticket.title}</span>
                              {ticket.lastMessage?.sender.id !== Number(currentTicketId) && (
                                <Badge className="ml-1 shrink-0 bg-primary px-1.5 text-[10px]">{t("unread")}</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                              <StatusBadge status={ticket.status} />
                              <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                              <span className="line-clamp-1">{t(ticket.category)}</span>
                              <span>•</span>
                              <span
                                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${getPriorityColor(ticket.priority)}`}
                              >
                                {t(ticket.priority)}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {/* <TooltipContent side="right" className="max-w-[250px] space-y-1 p-3">
                      <div className="font-medium">{ticket.title}</div>
                    </TooltipContent> */}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="group-data-[collapsible=icon]:mx-auto group-data-[collapsible!=icon]:p-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full gap-1.5 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                asChild
              >
                <a href="/user/tickets/create">
                  <PlusIcon className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{joinTrans([t("create"), t("tkt_other")])}</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
              {joinTrans([t("create"), t("tkt_other")])}
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
                  <span className="group-data-[collapsible=icon]:hidden">{joinTrans([t("view"), t("all"), t("tkt_other")])}</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-data-[state=expanded]:hidden">
              {joinTrans([t("view"), t("all"), t("tkt_other")])}
            </TooltipContent>
          </Tooltip>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  )
}
