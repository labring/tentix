import { userTicketsQueryOptions } from "@lib/query";
import { useTransferModal } from "@modal/use-transfer-modal.tsx";
import { useUpdatePriorityModal } from "@modal/use-update-priority-modal.tsx";
import { useStaffCloseConfirmationModal } from "@modal/use-staff-close-confirmation-modal.tsx";
import { useCustomerFeedbackModal } from "@modal/use-customer-feedback-modal.tsx";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { joinTrans, useTranslation } from "i18n";
import {
  Loader2Icon,
  PlusIcon,
  ClipboardPasteIcon,
  SquareAsteriskIcon,
  EllipsisIcon,
  CircleStopIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import * as React from "react";
import { useMemo, useState } from "react";
import {
  type GetUserTicketsResponseType,
  type TicketsListItemType,
} from "tentix-server/rpc";
import {
  LayersIcon,
  PendingIcon,
  ProgressIcon,
  DoneIcon,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PriorityBadge,
  StatusBadge,
  Input,
  ScrollArea,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "tentix-ui";
import useDebounce from "@hook/use-debounce";
import { userTablePagination } from "@store/table-pagination";
import { cn } from "@lib/utils";

interface PaginatedTableProps {
  character: "user" | "staff";
  initialData?: GetUserTicketsResponseType;
}

export function PaginatedDataTable({
  character,
  initialData,
}: PaginatedTableProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // 使用 zustand store 管理分页状态
  const {
    currentPage,
    pageSize,
    searchQuery,
    statuses,
    allTicket,
    readStatus,
    setCurrentPage,
    setSearchQuery,
    setStatuses,
    setAllTicket,
  } = userTablePagination();

  const handleStatusToggle = (
    status: "pending" | "in_progress" | "resolved",
  ) => {
    const newStatuses = statuses.includes(status)
      ? statuses.filter((s) => s !== status)
      : [...statuses, status];

    const mainStatuses: string[] = ["pending", "in_progress", "resolved"];
    const allMainStatusesSelected = mainStatuses.every((s) =>
      newStatuses.includes(s),
    );

    if (allMainStatusesSelected && newStatuses.length === mainStatuses.length) {
      setStatuses([]);
    } else {
      setStatuses(newStatuses);
    }
  };

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1316 : false,
  );

  const { openTransferModal, transferModal } = useTransferModal();
  const { updatePriorityModal, openUpdatePriorityModal } =
    useUpdatePriorityModal();
  const { openStaffCloseConfirmationModal, staffCloseConfirmationModal } =
    useStaffCloseConfirmationModal();
  const { openCustomerFeedbackModal, customerFeedbackModal } =
    useCustomerFeedbackModal();
  // Listen for window resize to update screen size
  React.useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 1316);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Use regular query for page-based pagination
  const { data, isLoading, error } = useQuery({
    ...userTicketsQueryOptions(
      pageSize,
      currentPage,
      debouncedSearchQuery,
      statuses,
      readStatus,
      allTicket,
    ),
    initialData:
      initialData &&
      currentPage === 1 &&
      statuses.length === 0 &&
      !debouncedSearchQuery
        ? initialData
        : undefined,
  });

  // Get tickets and stats directly from API response
  const tickets = data?.tickets || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 0;

  const stats = useMemo(() => {
    const statsData = data?.stats || [];
    const statsMap = new Map(
      statsData.map((stat) => [stat.status, stat.count]),
    );

    return {
      pending: statsMap.get("pending") || 0,
      inProgress: statsMap.get("in_progress") || 0,
      resolved: statsMap.get("resolved") || 0,
      scheduled: statsMap.get("scheduled") || 0,
    };
  }, [data?.stats]);

  // Define column widths with responsive behavior - 1fr on small screens for adaptive sizing
  const columnWidths = React.useMemo(() => {
    if (isSmallScreen) {
      // On small screens, use 1fr for all columns to distribute space evenly
      const smallScreenWidths =
        character === "staff"
          ? {
              title: "1fr",
              status: "1fr",
              priority: "1fr",
              submittedDate: "1fr",
              updatedDate: "1fr",
              area: "1fr",
              module: "1fr",
              submittedBy: "1fr",
              actions: "60px", // Keep actions column minimal
            }
          : {
              title: "1fr",
              status: "1fr",
              submittedDate: "1fr",
              updatedDate: "1fr",
              area: "1fr",
              module: "1fr",
              actions: "50px", // Keep actions column minimal
            };
      return smallScreenWidths;
    }

    // On larger screens, use optimized fixed widths
    const baseWidths =
      character === "staff"
        ? {
            title: "250px",
            status: "150px",
            priority: "100px",
            submittedDate: "1fr",
            updatedDate: "1fr",
            area: "100px",
            module: "120px",
            submittedBy: "150px",
            actions: "78px",
          }
        : {
            title: "350px",
            status: "220px",
            submittedDate: "1fr",
            updatedDate: "1fr",
            area: "120px",
            module: "150px",
            actions: "68px",
          };
    return baseWidths;
  }, [character, isSmallScreen]);

  const columns = React.useMemo<ColumnDef<TicketsListItemType>[]>(() => {
    const baseColumns: ColumnDef<TicketsListItemType>[] = [
      {
        accessorKey: "title",
        header: t("title"),
        cell: ({ row }) => {
          return (
            <p
              className={`text-black text-sm font-medium leading-none truncate ${
                isSmallScreen
                  ? "max-w-[80px]" // 小屏幕：更严格的截断
                  : "max-w-[240px]" // 大屏幕：较宽松的截断
              }`}
              title={row.original.title} // 悬停时显示完整标题
            >
              {row.original.title}
            </p>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "submittedDate",
        header: t("created_at"),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <p className="text-sm font-normal leading-normal text-zinc-600">
              {date.toLocaleString("sv-SE", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          );
        },
      },
      {
        accessorKey: "updatedDate",
        header: t("updated_at"),
        cell: ({ row }) => {
          const date = new Date(row.original.updatedAt);
          return (
            <p className="text-sm font-normal leading-normal text-zinc-600">
              {date.toLocaleString("sv-SE", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          );
        },
      },
      {
        accessorKey: "area",
        header: t("area"),
        cell: ({ row }) => (
          <p className="text-zinc-600 text-sm font-normal leading-normal">
            {row.original.area}
          </p>
        ),
      },
      {
        accessorKey: "module",
        header: t("module"),
        cell: ({ row }) => (
          <p className="text-zinc-600 text-sm font-normal leading-normal">
            {t(row.original.module)}
          </p>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const ticket = row.original;
          const ticketId = ticket.id;
          const isResolved = ticket.status === "resolved";

          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                    size="icon"
                  >
                    <EllipsisIcon className="!h-4 !w-4 text-zinc-500" />
                    <span className="sr-only">{t("open_menu")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-auto p-2 rounded-xl"
                >
                  {character === "staff" && (
                    <>
                      <DropdownMenuItem
                        onClick={() => openTransferModal(ticketId)}
                      >
                        <ClipboardPasteIcon className="mr-2 !h-4 !w-4 text-zinc-500" />
                        {t("transfer_ticket")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openUpdatePriorityModal(
                            ticketId,
                            ticket.title.length > 6
                              ? `${ticket.title.slice(0, 6)}...`
                              : ticket.title,
                            ticket.priority,
                          )
                        }
                      >
                        <SquareAsteriskIcon className="mr-2 h-4 w-4 text-zinc-500" />
                        {t("set_prty")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    disabled={isResolved}
                    onSelect={(e) => {
                      if (isResolved) {
                        e.preventDefault();
                        return;
                      }
                      e.preventDefault();
                      // Different dialogs for different user types
                      if (character === "user") {
                        openCustomerFeedbackModal(ticketId);
                      } else {
                        openStaffCloseConfirmationModal(ticketId);
                      }
                    }}
                    className={
                      isResolved ? "opacity-50 cursor-not-allowed" : ""
                    }
                  >
                    <CircleStopIcon
                      className={`mr-2 h-4 w-4 ${isResolved ? "text-zinc-300" : "text-zinc-500"}`}
                    />
                    {joinTrans([t("close"), t("tkt_one")])}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        },
      },
    ];

    // Add staff-specific columns
    if (character === "staff") {
      // Add priority column after status (index 2)
      baseColumns.splice(2, 0, {
        accessorKey: "priority",
        header: t("priority"),
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      });

      // Add submittedBy column after module (index 7, considering priority was inserted)
      baseColumns.splice(7, 0, {
        accessorKey: "submittedBy",
        header: t("rqst_by"),
        cell: ({ row }) => (
          <p className="text-zinc-600 text-sm font-normal leading-normal">
            {row.original.customer.name}
          </p>
        ),
      });
    }

    return baseColumns;
  }, [
    character,
    t,
    isSmallScreen,
    openTransferModal,
    openUpdatePriorityModal,
    openStaffCloseConfirmationModal,
    openCustomerFeedbackModal,
  ]);

  const table = useReactTable({
    data: tickets,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const StatusTabBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;

    return (
      <Badge
        variant="secondary"
        className="w-5 h-5 flex justify-center items-center rounded-full border-[0.5px] border-zinc-200 bg-zinc-100 text-zinc-500 text-xs font-normal leading-none"
      >
        {count}
      </Badge>
    );
  };

  const renderTableContent = (onClick?: (row: TicketsListItemType) => void) => {
    const rows = table.getRowModel().rows;

    // Get visible columns and their keys
    const visibleColumns = table.getVisibleLeafColumns();
    const columnKeys = visibleColumns.map((col) => col.id);

    // Generate CSS grid template columns based on column widths
    const gridTemplateColumns = columnKeys
      .map((key) => {
        const columnKey = key as keyof typeof columnWidths;
        return columnWidths[columnKey] || "1fr";
      })
      .join(" ");

    if (rows.length === 0 && !isLoading) {
      return (
        <div className="flex-1 flex flex-col px-4 lg:px-6">
          <div
            className={cn(
              "flex  items-center justify-center border border-dashed border-zinc-300 rounded-2xl bg-no-repeat bg-center relative h-full",
              character === "user" ? "cursor-pointer" : "",
            )}
            onClick={() => {
              if (character === "user") {
                router.navigate({
                  to: "/user/newticket",
                });
              }
            }}
            style={{
              backgroundImage: "url(/tentix-bg.svg)",
              backgroundSize: "80%",
            }}
          >
            <div
              className={`flex flex-col items-center justify-center mt-23 z-10 relative ${
                character === "user" ? "cursor-pointer" : ""
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-black text-2xl font-medium leading-8 mb-1">
                  {character === "user"
                    ? t("no_tickets_created_yet")
                    : t("no_tickets_found")}
                </p>
                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-gray-600 text-base font-normal leading-6">
                    {character === "user"
                      ? t("click_to_create_ticket")
                      : t("no_tickets_received")}
                  </p>
                  {character === "user" && (
                    <p className="text-gray-600 text-base font-normal leading-6">
                      {t("team_resolve_questions")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col px-4 lg:px-6  gap-3">
        {/* Table Header - Fixed */}
        <div className="flex-shrink-0 bg-white rounded-lg border border-zinc-200">
          <div
            className="grid items-center px-6 h-10 text-zinc-500 text-sm font-normal leading-normal"
            style={{
              gridTemplateColumns,
            }}
          >
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <div key={header.id} className="flex items-center">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </div>
              )),
            )}
          </div>
        </div>

        {/* Table Body - Scrollable Container */}
        <ScrollArea className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center justify-center text-zinc-500 text-sm font-medium">
                <Loader2Icon className="h-4 w-4 animate-spin mr-2 text-zinc-500" />
                {t("loading")}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className={`grid items-center px-6 h-14 text-black text-sm font-medium leading-none hover:bg-zinc-50 transition-colors ${onClick ? "cursor-pointer" : ""} ${
                    index < rows.length - 1 ? "border-b border-zinc-200" : ""
                  } ${index === 0 ? "hover:rounded-t-xl" : ""} ${
                    index === rows.length - 1 ? "hover:rounded-b-xl" : ""
                  }`}
                  style={{
                    gridTemplateColumns,
                  }}
                  {...(onClick && {
                    onClick: (e) => {
                      // avoid click on button or anchor element
                      if (
                        e.target instanceof HTMLButtonElement ||
                        e.target instanceof HTMLAnchorElement ||
                        (e.target as HTMLElement).closest("button") ||
                        (e.target as HTMLElement).closest("a")
                      ) {
                        return;
                      }

                      if (
                        (e.target as HTMLElement).closest(
                          '[role="menuitem"]',
                        ) ||
                        (e.target as HTMLElement).closest(
                          "[data-radix-popper-content-wrapper]",
                        )
                      ) {
                        return;
                      }

                      onClick(row.original);
                    },
                  })}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} className="flex items-center">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Pagination Controls */}
        {rows.length > 0 && !isLoading && (
          <div className="flex-shrink-0 flex items-center justify-between py-3">
            {/* Left side - Total count */}
            <div className="text-sm font-normal leading-normal text-zinc-500">
              {t("total")}: {totalCount}
            </div>

            {/* Right side - Pagination controls */}
            <div className="flex items-center gap-2">
              {/* First page */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1 || isLoading}
              >
                <ChevronsLeftIcon
                  className={`h-4 w-4 ${currentPage <= 1 || isLoading ? "text-zinc-300" : "text-zinc-900"}`}
                />
              </Button>

              {/* Previous page */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
              >
                <ChevronLeftIcon
                  className={`h-4 w-4 ${currentPage <= 1 || isLoading ? "text-zinc-300" : "text-zinc-900"}`}
                />
              </Button>

              {/* Current page / Total pages */}
              <div className="flex items-center text-sm mx-2">
                <span className="text-zinc-900  font-medium leading-normal">
                  {currentPage}
                </span>
                <span className="text-zinc-500 font-medium leading-normal mx-1">
                  /
                </span>
                <span className="text-zinc-500 font-medium leading-normal">
                  {totalPages}
                </span>
              </div>

              {/* Next page */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
              >
                <ChevronRightIcon
                  className={`h-4 w-4 ${currentPage >= totalPages || isLoading ? "text-zinc-300" : "text-zinc-900"}`}
                />
              </Button>

              {/* Last page */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages || isLoading}
              >
                <ChevronsRightIcon
                  className={`h-4 w-4 ${currentPage >= totalPages || isLoading ? "text-zinc-300" : "text-zinc-900"}`}
                />
              </Button>

              {/* Page size indicator */}
              <div className="flex items-center text-sm ml-4">
                <span className="text-zinc-900 font-normal leading-normal">
                  {pageSize}
                </span>
                <span className="text-zinc-500 font-normal leading-normal mx-1">
                  /
                </span>
                <span className="text-zinc-500 font-normal leading-normal">
                  {t("page")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500">{t("error_loading_tickets")}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-1 flex-col min-w-0 bg-zinc-50">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 h-24 bg-zinc-50">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatuses([])}
            className={`h-10 flex justify-center items-center gap-2 self-stretch px-3 rounded-lg border border-zinc-200 transition-colors ${
              statuses.length === 0 ? "bg-black/[0.03]" : "hover:bg-zinc-50"
            }`}
          >
            <LayersIcon
              className={`h-4 w-4 ${
                statuses.length === 0 ? "text-foreground" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                statuses.length === 0
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("all")}
            </span>
            <StatusTabBadge
              count={
                Number(stats.pending) +
                Number(stats.inProgress) +
                Number(stats.resolved) +
                Number(stats.scheduled)
              }
            />
          </button>
          <button
            onClick={() => handleStatusToggle("pending")}
            className={`flex justify-center items-center gap-2 self-stretch px-3 py-1 rounded-lg border border-zinc-200 transition-colors ${
              statuses.includes("pending")
                ? "bg-black/[0.03]"
                : "hover:bg-zinc-50"
            }`}
          >
            <PendingIcon
              className={`h-4 w-4 ${
                statuses.includes("pending") ? "text-blue-600" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                statuses.includes("pending")
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("pending")}
            </span>
            <StatusTabBadge count={Number(stats.pending)} />
          </button>
          <button
            onClick={() => handleStatusToggle("in_progress")}
            className={`flex justify-center items-center gap-2 self-stretch px-3 py-1 rounded-lg border border-zinc-200 transition-colors ${
              statuses.includes("in_progress")
                ? "bg-black/[0.03]"
                : "hover:bg-zinc-50"
            }`}
          >
            <ProgressIcon
              className={`h-4 w-4 ${
                statuses.includes("in_progress")
                  ? "text-yellow-500"
                  : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                statuses.includes("in_progress")
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("in_progress")}
            </span>
            <StatusTabBadge count={Number(stats.inProgress)} />
          </button>
          <button
            onClick={() => handleStatusToggle("resolved")}
            className={`flex justify-center items-center gap-2 self-stretch px-3 py-1 rounded-lg border border-zinc-200 transition-colors ${
              statuses.includes("resolved")
                ? "bg-black/[0.03]"
                : "hover:bg-zinc-50"
            }`}
          >
            <DoneIcon
              className={`h-4 w-4 ${
                statuses.includes("resolved")
                  ? "text-blue-600"
                  : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                statuses.includes("resolved")
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("completed")}
            </span>
            <StatusTabBadge count={Number(stats.resolved)} />
          </button>
        </div>

        {/* search */}
        <div className="flex items-center gap-3">
          {character !== "user" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <Switch
                      checked={allTicket}
                      onCheckedChange={(checked) => setAllTicket(checked)}
                      className="data-[state=checked]:bg-primary mr-4"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {allTicket ? (
                    <p>{t("only_mine")}</p>
                  ) : (
                    <p>{t("all_tickets")}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={joinTrans([t("search"), t("tkt_other")])}
              className="pl-10 pr-3 text-sm leading-none h-10 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {character === "user" && (
            <Link to="/user/newticket">
              <Button
                variant="default"
                size="sm"
                className="h-[40px] px-4 gap-2 flex justify-center items-center rounded-lg shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border-none"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden lg:inline">
                  {joinTrans([t("create"), t("tkt_one")])}
                </span>
                <span className="lg:hidden">{t("create")}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Content - Flex container with proper height constraint */}
      {renderTableContent((row) => {
        router.navigate({
          to: character === "user" ? `/user/tickets/$id` : `/staff/tickets/$id`,
          params: { id: row.id },
        });
      })}

      {transferModal}
      {updatePriorityModal}
      {staffCloseConfirmationModal}
      {customerFeedbackModal}
    </div>
  );
}
