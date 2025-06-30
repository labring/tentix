import { apiClient } from "@lib/api-client";
import { updateTicketStatus } from "@lib/query";
import { useRaiseReqModal } from "@modal/use-raise-req-modal.tsx";
import { useTransferModal } from "@modal/use-transfer-modal.tsx";
import { useUpdateStatusModal } from "@modal/use-update-status-modal.tsx";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { joinTrans, useTranslation } from "i18n";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  Loader2Icon,
  PlusIcon,
  Settings2,
  UserRoundPlusIcon,
  EllipsisIcon,
  CircleStopIcon,
  SearchIcon,
} from "lucide-react";
import * as React from "react";
import { useMemo, useState, useCallback } from "react";
import { type TicketsAllListItemType } from "tentix-server/rpc";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PriorityBadge,
  StatusBadge,
  toast,
  Input,
} from "tentix-ui";

interface PaginatedTableProps {
  character: "user" | "staff";
  initialData?: {
    tickets: TicketsAllListItemType[];
    hasMore: boolean;
    nextPageToken: string | null;
    stats: Array<{ status: string; count: number }>;
  };
}

export function PaginatedDataTable({
  character,
  initialData,
}: PaginatedTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [pageSize] = useState(40);
  const [tabValue, setTabValue] = useState<
    TicketsAllListItemType["status"] | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1316 : false,
  );

  const { openTransferModal, transferModal } = useTransferModal();
  const { updateStatusModal, openUpdateStatusModal } = useUpdateStatusModal();
  const { raiseReqModal, openRaiseReqModal } = useRaiseReqModal();

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

  // Close ticket mutation
  const closeTicketMutation = useMutation({
    mutationFn: updateTicketStatus,
    onSuccess: (data) => {
      toast({
        title: t("success"),
        description: data.message || t("ticket_closed"),
        variant: "default",
      });
      // refresh user's ticket data
      queryClient.invalidateQueries({
        queryKey: ["getUserTickets"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_close_ticket"),
        variant: "destructive",
      });
    },
  });

  // Handle close ticket
  const handleCloseTicket = useCallback(
    (ticketId: string, event?: React.MouseEvent) => {
      event?.stopPropagation(); // avoid click on button or anchor element
      closeTicketMutation.mutate({
        ticketId,
        status: "resolved",
        description: t("close_ticket"),
      });
    },
    [closeTicketMutation, t],
  );

  // Use infinite query for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ["getUserTickets", pageSize, tabValue, searchQuery],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {
        pageSize: pageSize.toString(),
      };
      if (pageParam) {
        params.pageToken = pageParam;
      }

      const response = await apiClient.user.getTickets.$get({ query: params });
      return response.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
    initialData: initialData
      ? {
          pages: [initialData],
          pageParams: [undefined],
        }
      : undefined,
  });

  // Flatten all tickets from all pages
  const allTickets = useMemo(() => {
    return data?.pages.flatMap((page) => page.tickets) || [];
  }, [data]);

  // Get stats from the first page (stats should be consistent across pages)
  const stats = useMemo(() => {
    const statsData = data?.pages[0]?.stats || [];
    const statsMap = new Map(
      statsData.map((stat) => [stat.status, stat.count]),
    );

    return {
      pending: statsMap.get("pending") || 0,
      inProgress: statsMap.get("in_progress") || 0,
      resolved: statsMap.get("resolved") || 0,
      scheduled: statsMap.get("scheduled") || 0,
    };
  }, [data]);

  // Filter tickets based on tab selection and search query
  const filteredTickets = useMemo(() => {
    let tickets = allTickets;

    // Filter by status tab
    if (tabValue !== "all") {
      tickets = tickets.filter((ticket) => ticket.status === tabValue);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      tickets = tickets.filter((ticket) =>
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    return tickets;
  }, [allTickets, tabValue, searchQuery]);

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

  const columns = React.useMemo<ColumnDef<TicketsAllListItemType>[]>(() => {
    const baseColumns: ColumnDef<TicketsAllListItemType>[] = [
      {
        accessorKey: "title",
        header: t("title"),
        cell: ({ row }) => {
          return (
            <p
              className={`text-black text-sm font-medium leading-none truncate ${
                isSmallScreen
                  ? "max-w-[120px]" // 小屏幕：更严格的截断
                  : "max-w-[200px]" // 大屏幕：较宽松的截断
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
            <p className="text-zinc-600 text-sm font-normal leading-normal">
              {date.toLocaleDateString()}
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
            <p className="text-zinc-600 text-sm font-normal leading-normal">
              {date.toLocaleDateString()}
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
          const staffData =
            character === "staff"
              ? {
                  assignedTo: "",
                  status: row.original.status,
                }
              : null;

          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                    size="icon"
                  >
                    <EllipsisIcon className="!h-5 !w-5 text-zinc-500" />
                    <span className="sr-only">{t("open_menu")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto p-2 ">
                  {character === "staff" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openTransferModal(ticketId)}
                      >
                        <UserRoundPlusIcon className="mr-2 h-4 w-4" />
                        {t("transfer")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openUpdateStatusModal(
                            ticketId,
                            staffData?.status || "",
                          )
                        }
                      >
                        <AlertTriangleIcon className="mr-2 h-4 w-4" />
                        {t("adjust_prty")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          openUpdateStatusModal(
                            ticketId,
                            staffData?.status || "",
                          )
                        }
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        {t("update_status")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openRaiseReqModal(ticketId)}
                      >
                        <ClipboardListIcon className="mr-2 h-4 w-4" />
                        {t("raise_req")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleCloseTicket(ticketId, e)}
                      >
                        <CheckCircle2Icon className="mr-2 h-4 w-4" />
                        {t("mark_as_solved")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    disabled={isResolved}
                    onClick={
                      isResolved
                        ? undefined
                        : (e) => handleCloseTicket(ticketId, e)
                    }
                    onMouseDown={(e) => {
                      if (isResolved) {
                        e.stopPropagation();
                        e.preventDefault();
                      }
                    }}
                    onPointerDown={(e) => {
                      if (isResolved) {
                        e.stopPropagation();
                        e.preventDefault();
                      }
                    }}
                    className={
                      isResolved ? "opacity-50 cursor-not-allowed" : ""
                    }
                  >
                    <CircleStopIcon
                      className={`h-4 w-4 ${isResolved ? "text-zinc-300" : "text-zinc-500"}`}
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
    openUpdateStatusModal,
    openRaiseReqModal,
    handleCloseTicket,
  ]);

  const table = useReactTable({
    data: filteredTickets,
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

  const renderTableContent = (
    onClick?: (row: TicketsAllListItemType) => void,
  ) => {
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

    return (
      <div className="flex-1 min-h-0 flex flex-col px-4 lg:px-6 pb-4 gap-3">
        {/* 只有在有数据或正在加载时才显示表头 */}
        {(rows.length > 0 || isLoading) && (
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
        )}

        {/* Table Body - Single Scrollable Container */}
        {rows.length > 0 ? (
          <div className="flex-1 min-h-0 bg-white border border-zinc-200 rounded-xl mt-3">
            <div className="h-full overflow-y-auto">
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

              {/* Load More Button - Inside scroll container */}
              {hasNextPage && (
                <div className="flex justify-center p-4 border-t border-zinc-200 bg-white">
                  <Button
                    variant="default"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                        {t("loading_more")}
                      </>
                    ) : (
                      t("load_more")
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center ">
            <div className="flex items-center justify-center text-zinc-500 text-sm font-medium">
              <Loader2Icon className="h-4 w-4 animate-spin mr-2 text-zinc-500" />
              {t("loading")}
            </div>
          </div>
        ) : (
          <div
            className="flex-1 flex items-center justify-center border border-dashed border-zinc-300 rounded-2xl bg-no-repeat bg-center relative"
            style={{
              backgroundImage: "url(/tentix-bg.svg)",
              backgroundSize: "80%",
            }}
          >
            <div
              className={`flex flex-col items-center justify-center z-10 relative ${
                character === "user" ? "cursor-pointer" : ""
              }`}
              onClick={() => {
                if (character === "user") {
                  router.navigate({
                    to: "/user/newticket",
                  });
                }
              }}
            >
              <div className="flex flex-col items-center justify-center text-center mt-23">
                <p className="text-black text-2xl font-medium leading-8 mb-1">
                  {t("no_tickets_created_yet")}
                </p>
                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-gray-600 text-base font-normal leading-6">
                    {t("click_to_create_ticket")}
                  </p>
                  <p className="text-gray-600 text-base font-normal leading-6">
                    {t("team_resolve_questions")}
                  </p>
                </div>
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
            onClick={() => setTabValue("all")}
            className={`h-10 flex justify-center items-center gap-2 self-stretch px-3 rounded-lg border border-zinc-200 transition-colors ${
              tabValue === "all" ? "bg-black/[0.03]" : "hover:bg-zinc-50"
            }`}
          >
            <LayersIcon
              className={`h-4 w-4 ${
                tabValue === "all" ? "text-foreground" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                tabValue === "all"
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
            onClick={() => setTabValue("pending")}
            className={`flex justify-center items-center gap-2 self-stretch px-3 py-1 rounded-lg border border-zinc-200 transition-colors ${
              tabValue === "pending" ? "bg-black/[0.03]" : "hover:bg-zinc-50"
            }`}
          >
            <PendingIcon
              className={`h-4 w-4 ${
                tabValue === "pending" ? "text-foreground" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                tabValue === "pending"
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("pending")}
            </span>
            <StatusTabBadge count={stats.pending} />
          </button>
          <button
            onClick={() => setTabValue("in_progress")}
            className={`flex justify-center items-center gap-2 self-stretch px-3 py-1 rounded-lg border border-zinc-200 transition-colors ${
              tabValue === "in_progress"
                ? "bg-black/[0.03]"
                : "hover:bg-zinc-50"
            }`}
          >
            <ProgressIcon
              className={`h-4 w-4 ${
                tabValue === "in_progress" ? "text-foreground" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                tabValue === "in_progress"
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("in_progress")}
            </span>
            <StatusTabBadge count={stats.inProgress} />
          </button>
          <button
            onClick={() => setTabValue("resolved")}
            className={`flex justify-center items-center gap-2 self-stretch px-3 py-1 rounded-lg border border-zinc-200 transition-colors ${
              tabValue === "resolved" ? "bg-black/[0.03]" : "hover:bg-zinc-50"
            }`}
          >
            <DoneIcon
              className={`h-4 w-4 ${
                tabValue === "resolved" ? "text-foreground" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-center text-sm leading-5 ${
                tabValue === "resolved"
                  ? "text-foreground font-semibold"
                  : "text-zinc-900 font-normal"
              }`}
            >
              {t("completed")}
            </span>
            <StatusTabBadge count={stats.resolved} />
          </button>
        </div>

        {/* search */}
        <div className="flex items-center gap-3">
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
      {updateStatusModal}
      {raiseReqModal}
    </div>
  );
}
