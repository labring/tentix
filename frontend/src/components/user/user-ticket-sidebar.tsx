import useLocalUser from "@hook/use-local-user";
import { Link } from "@tanstack/react-router";
import { joinTrans, useTranslation } from "i18n";
import { ArrowLeftIcon, SearchIcon, ChevronDownIcon } from "lucide-react";
import React, { useState } from "react";
import { type TicketsListItemType } from "tentix-server/rpc";
import type { JSONContent } from "@tiptap/react";
import {
  Button,
  Input,
  ScrollArea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  PendingIcon,
  ProgressIcon,
  DoneIcon,
} from "tentix-ui";

// Function to extract text content from JSONContent description
function extractTextFromDescription(content: JSONContent): string {
  if (!content) return "";

  let text = "";

  const extractText = (node: JSONContent): void => {
    if (node.type === "text") {
      text += node.text || "";
    } else if (node.type === "paragraph" && node.content) {
      node.content.forEach(extractText);
      text += " ";
    } else if (node.content) {
      node.content.forEach(extractText);
    }
  };

  extractText(content);
  return text.trim();
}

// Custom status display function
function getStatusDisplay(
  status: TicketsListItemType["status"],
  t: (key: string) => string,
) {
  switch (status) {
    case "pending":
    case "scheduled":
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-blue-600",
      };
    case "in_progress":
      return {
        label: t("in_progress"),
        icon: ProgressIcon,
        color: "text-yellow-500",
      };
    case "resolved":
      return {
        label: t("resolved"),
        icon: DoneIcon,
        color: "text-blue-600",
      };
    default:
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-blue-600",
      };
  }
}

export function UserTicketSidebar({
  data,
  currentTicketId,
  isCollapsed,
}: {
  data: TicketsListItemType[];
  currentTicketId: string;
  isCollapsed: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<
    ("all" | "pending" | "in_progress" | "resolved")[]
  >(["all"]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const { t } = useTranslation();
  const { id: userId } = useLocalUser();

  // Status options
  const statusOptions = [
    { value: "all" as const, label: t("all"), icon: null },
    { value: "pending" as const, label: t("pending"), icon: PendingIcon },
    {
      value: "in_progress" as const,
      label: t("in_progress"),
      icon: ProgressIcon,
    },
    {
      value: "resolved" as const,
      label: t("resolved"),
      icon: DoneIcon,
    },
  ];

  // Handle status selection
  const handleStatusChange = (
    status: "all" | "pending" | "in_progress" | "resolved",
    checked: boolean,
  ) => {
    if (status === "all") {
      if (checked) {
        setSelectedStatuses(["all"]);
      } else {
        setSelectedStatuses([]);
      }
    } else {
      if (checked) {
        const newStatuses = selectedStatuses.filter((s) => s !== "all");
        newStatuses.push(status);
        setSelectedStatuses(newStatuses);
      } else {
        const newStatuses = selectedStatuses.filter(
          (s) => s !== status && s !== "all",
        );
        setSelectedStatuses(newStatuses);
      }
    }
  };

  // Get display text for the trigger
  const getDisplayText = () => {
    if (selectedStatuses.includes("all") || selectedStatuses.length === 0) {
      return t("all_status");
    }
    if (selectedStatuses.length === 1) {
      const status = selectedStatuses[0];
      return statusOptions.find((opt) => opt.value === status)?.label || "";
    }
    // For multiple selections, don't show text, only icons
    return "";
  };

  // Get display icons for the trigger
  const getDisplayIcons = () => {
    if (selectedStatuses.includes("all") || selectedStatuses.length === 0) {
      return [];
    }
    return selectedStatuses
      .filter((status) => status !== "all")
      .map((status) => {
        const option = statusOptions.find((opt) => opt.value === status);
        return { icon: option?.icon, status };
      })
      .filter((item) => item.icon) as Array<{
      icon: React.ComponentType<any>;
      status: string;
    }>;
  };

  // Check if a ticket is unread
  const isTicketUnread = (ticket: TicketsListItemType) => {
    return !ticket.messages
      .at(-1)
      ?.readStatus.some((message) => message.userId === userId);
  };

  // Filter tickets based on search query, selected statuses, and unread status
  const filteredTickets =
    data?.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (selectedStatuses.includes("all") ||
          selectedStatuses.includes(
            ticket.status as "pending" | "in_progress" | "resolved",
          )) &&
        (!showUnreadOnly || isTicketUnread(ticket)),
    ) || [];

  // Sort tickets by updated time
  const sortedTickets = [...filteredTickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div
      className={`w-75 h-full border-r bg-white transition-all duration-300 flex-col ${isCollapsed ? "hidden" : "hidden xl:flex"}`}
    >
      {/* Header - fixed height */}
      <div className="flex h-14 px-4 items-center gap-2 border-b flex-shrink-0">
        <Link to="/user/tickets/list">
          <ArrowLeftIcon className="h-5 w-5 text-black" />
        </Link>
        <p className="text-sm font-semibold leading-none text-black">
          {joinTrans([t("my"), t("tkt_other")])}
        </p>
      </div>

      {/* Search - fixed height */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 flex-shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={joinTrans([t("search"), t("tkt_other")])}
            className="pl-11 pr-3 text-sm leading-none h-10 rounded-[8px]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 flex-1 px-3 justify-between text-sm font-normal leading-none rounded-[8px]"
              >
                <div className="flex items-center gap-2">
                  {getDisplayIcons().map(
                    ({ icon: IconComponent, status }, index) => (
                      <IconComponent
                        key={index}
                        className={`h-4 w-4 ${
                          status === "in_progress"
                            ? "text-yellow-500"
                            : status === "resolved"
                              ? "text-blue-600"
                              : ""
                        }`}
                      />
                    ),
                  )}
                  {(selectedStatuses.includes("all") ||
                    selectedStatuses.length === 0 ||
                    selectedStatuses.length === 1) && (
                    <span className="text-sm font-normal">
                      {getDisplayText()}
                    </span>
                  )}
                </div>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 py-2 rounded-xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]"
              align="start"
            >
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground h-7">
                {t("status_filter")}
              </DropdownMenuLabel>
              {statusOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedStatuses.includes(option.value)}
                  onCheckedChange={(checked) =>
                    handleStatusChange(option.value, checked)
                  }
                  className="text-sm font-normal text-foreground hover:rounded-lg focus:bg-accent focus:text-accent-foreground gap-2"
                >
                  <span>{option.label}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className={`h-10 flex px-3 text-center text-sm leading-5 rounded-[8px] border border-zinc-200 transition-all ${
              showUnreadOnly
                ? "bg-black/[0.03] font-semibold"
                : "font-normal hover:bg-black/[0.03]"
            }`}
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            {t("unread")}
          </Button>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="flex flex-col items-center gap-4 p-4">
            {sortedTickets.map((ticket) => {
              const statusDisplay = getStatusDisplay(ticket.status, t);
              const isUnread = isTicketUnread(ticket);
              const isSelected = ticket.id === currentTicketId;
              const descriptionText = extractTextFromDescription(
                ticket.description,
              );

              return (
                <Link
                  key={ticket.id}
                  to="/user/tickets/$id"
                  params={{ id: ticket.id }}
                  className={`
                    relative block w-[266px] rounded-[8px] border border-zinc-200 p-4 transition-all
                    ${isSelected ? "bg-zinc-100" : "hover:bg-zinc-50"}
                  `}
                >
                  {/* Unread indicator */}
                  {isUnread && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                  )}

                  {/* First part: Status + Time */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <statusDisplay.icon
                        className={`h-4 w-4 ${statusDisplay.color}`}
                      />
                      <span className="text-sm font-medium text-zinc-900 leading-5">
                        {statusDisplay.label}
                      </span>
                    </div>
                    <span className="text-sm font-normal text-[#3F3F46] leading-5">
                      {new Date(ticket.updatedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Divider line */}
                  <div className="h-[0.8px] bg-zinc-200 w-full mb-3"></div>

                  {/* Second part: Title + Description */}
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-zinc-900 leading-5 mb-1 line-clamp-1">
                      {ticket.title}
                    </h3>
                    {descriptionText && (
                      <p className="text-xs font-normal text-[#3F3F46] leading-4 line-clamp-2">
                        {descriptionText}
                      </p>
                    )}
                  </div>

                  {/* Third part: Module */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center justify-center gap-2.5 py-0.5 px-2.5 rounded-md border border-zinc-200 text-xs font-normal text-zinc-900 leading-4">
                      {t(ticket.module)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
