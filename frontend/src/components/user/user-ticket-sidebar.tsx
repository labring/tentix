import useLocalUser from "@hook/use-local-user";
import { Link } from "@tanstack/react-router";
import { joinTrans, useTranslation } from "i18n";
import type { TFunction } from "i18next";
import {
  ArrowLeftIcon,
  SearchIcon,
  ChevronDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { type TicketsListItemType } from "tentix-server/rpc";
import type { JSONContent } from "@tiptap/react";
import {
  Button,
  Input,
  ScrollArea,
  PendingIcon,
  ProgressIcon,
  DoneIcon,
  cn,
} from "tentix-ui";
import { userTablePagination } from "@store/table-pagination";
import { useQuery } from "@tanstack/react-query";
import { userTicketsQueryOptions } from "@lib/query";
import useDebounce from "@hook/use-debounce";

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
function getStatusDisplay(status: TicketsListItemType["status"], t: TFunction) {
  switch (status) {
    case "pending":
    case "scheduled":
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-zinc-400",
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
        color: "text-zinc-400",
      };
  }
}

export function UserTicketSidebar({
  currentTicketId,
  isCollapsed,
  isTicketLoading,
}: {
  currentTicketId: string;
  isCollapsed: boolean;
  isTicketLoading: boolean;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { id: userId } = useLocalUser();

  // 使用 table-pagination store
  const {
    currentPage,
    pageSize,
    searchQuery,
    statuses,
    readStatus,
    allTicket,
    setSearchQuery,
    setStatuses,
    setReadStatus,
    setCurrentPage,
  } = userTablePagination();

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // 🔥 将数据查询移到组件内部 - 这样状态变化只影响当前组件
  const { data: userTicketsData, isLoading: isUserTicketsLoading } = useQuery(
    userTicketsQueryOptions(
      pageSize,
      currentPage,
      debouncedSearchQuery,
      statuses,
      readStatus,
      allTicket,
      currentTicketId,
    ),
  );

  const totalPages = userTicketsData?.totalPages || 0;

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        setStatuses([]); // 空数组表示显示所有状态
      } else {
        setStatuses([]); // 取消全选也是空数组
      }
    } else {
      if (checked) {
        const newStatuses = [...statuses];
        if (!newStatuses.includes(status)) {
          newStatuses.push(status);
        }
        setStatuses(newStatuses);
      } else {
        const newStatuses = statuses.filter((s) => s !== status);
        setStatuses(newStatuses);
      }
    }
  };

  // Get display text for the trigger
  const getDisplayText = () => {
    if (statuses.length === 0) {
      return t("all_status");
    }
    if (statuses.length === 1) {
      const status = statuses[0];
      return statusOptions.find((opt) => opt.value === status)?.label || "";
    }
    // For multiple selections, don't show text, only icons
    return "";
  };

  // Get display icons for the trigger
  const getDisplayIcons = () => {
    if (statuses.length === 0) {
      return [];
    }
    return statuses
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

  const tickets = userTicketsData?.tickets || [];

  // Sort tickets by updated time
  const sortedTickets = [...tickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div
      // className={`w-75 h-full border-r bg-white transition-all duration-300 flex-col ${isCollapsed ? "hidden" : "hidden xl:flex"}`}
      className={`h-full border-r bg-white transition-all duration-300 ease-in-out flex-col overflow-hidden ${
        isCollapsed
          ? "w-0 opacity-0 xl:w-0 xl:opacity-0"
          : "w-75 opacity-100 xl:flex xl:w-75 xl:opacity-100"
      } hidden xl:flex`}
    >
      {/* Header - fixed height */}
      <div className="flex h-14 px-4 items-center border-b flex-shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <Link to="/user/tickets/list">
            <ArrowLeftIcon className="h-5 w-5 text-black" />
          </Link>
          <p className="text-sm font-semibold leading-none text-black">
            {joinTrans([t("my"), t("tkt_other")])}
          </p>
        </div>

        {tickets.length > 0 && !isUserTicketsLoading && !isTicketLoading && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1 || isUserTicketsLoading}
            >
              <ChevronLeftIcon
                className={`h-4 w-4 ${
                  currentPage <= 1 || isUserTicketsLoading
                    ? "text-zinc-300"
                    : "text-zinc-900"
                }`}
              />
            </Button>
            <div className="flex items-center text-sm mx-2">
              <span className="text-zinc-900 font-medium leading-normal">
                {currentPage}
              </span>
              <span className="text-zinc-500 font-medium leading-normal mx-1">
                /
              </span>
              <span className="text-zinc-500 font-medium leading-normal">
                {totalPages}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages || isUserTicketsLoading}
            >
              <ChevronRightIcon
                className={`h-4 w-4 ${
                  currentPage >= totalPages || isUserTicketsLoading
                    ? "text-zinc-300"
                    : "text-zinc-900"
                }`}
              />
            </Button>
          </div>
        )}
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
          <div className="relative flex-1" ref={dropdownRef}>
            <Button
              variant="outline"
              className="h-10 w-full px-3 justify-between text-sm font-normal leading-none rounded-[8px]"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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
                            : status === "pending"
                              ? "text-zinc-400"
                              : ""
                      }`}
                    />
                  ),
                )}
                {(statuses.length === 0 || statuses.length === 1) && (
                  <span className="text-sm font-normal">
                    {getDisplayText()}
                  </span>
                )}
              </div>
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 py-2 bg-white border border-zinc-200 rounded-xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] z-50">
                <div className="px-3 py-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("status_filter")}
                  </span>
                </div>
                {statusOptions.map((option) => {
                  const isChecked =
                    option.value === "all"
                      ? statuses.length === 0
                      : statuses.includes(option.value);

                  return (
                    <div
                      key={option.value}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 cursor-pointer"
                      onClick={() =>
                        handleStatusChange(option.value, !isChecked)
                      }
                    >
                      <div
                        className={cn(
                          "flex w-4 h-4 items-center justify-center rounded-sm border",
                          isChecked
                            ? "border-[#18181B] bg-[#18181B]"
                            : "border-[#18181B] bg-white",
                        )}
                      >
                        {isChecked && (
                          <CheckIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-normal text-foreground">
                        {option.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-10 flex px-3 text-center text-sm leading-5 rounded-[8px] border border-zinc-200 transition-all ${
              readStatus === "unread"
                ? "bg-black/[0.03] font-semibold"
                : "font-normal hover:bg-black/[0.03]"
            }`}
            onClick={() =>
              setReadStatus(readStatus === "unread" ? "all" : "unread")
            }
          >
            {t("unread")}
          </Button>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="flex flex-col items-center gap-4 p-4">
            {isUserTicketsLoading || isTicketLoading ? (
              <div className="text-sm text-muted-foreground">
                {t("loading")}
              </div>
            ) : (
              sortedTickets.map((ticket) => {
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
                    {isUnread && !isSelected && (
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
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
