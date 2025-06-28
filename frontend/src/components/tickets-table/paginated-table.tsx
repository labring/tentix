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

  const { openTransferModal, transferModal } = useTransferModal();
  const { updateStatusModal, openUpdateStatusModal } = useUpdateStatusModal();
  const { raiseReqModal, openRaiseReqModal } = useRaiseReqModal();

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
    queryKey: ["getUserTickets", pageSize, tabValue],
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

  // Filter tickets based on tab selection
  const filteredTickets = useMemo(() => {
    if (tabValue === "all") return allTickets;
    return allTickets.filter((ticket) => ticket.status === tabValue);
  }, [allTickets, tabValue]);

  // Define column widths with specific ratios to ensure alignment
  const columnWidths = React.useMemo(() => {
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
  }, [character]);

  const columns = React.useMemo<ColumnDef<TicketsAllListItemType>[]>(() => {
    const baseColumns: ColumnDef<TicketsAllListItemType>[] = [
      {
        accessorKey: "title",
        header: t("title"),
        cell: ({ row }) => {
          return (
            <p className="text-black text-sm font-medium leading-none">
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
            {row.original.module}
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
            {row.original.customer.nickname}
          </p>
        ),
      });
    }

    return baseColumns;
  }, [
    character,
    t,
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
    const noResultsMessage =
      tabValue !== "all"
        ? `No ${tabValue.toLowerCase()} ${character === "user" ? "requests" : "work orders"}.`
        : t("no_results");

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
      <div className="flex flex-col gap-3 h-full">
        {/* Table Header - Fixed */}
        <div className="flex-shrink-0 overflow-hidden bg-white rounded-lg border border-zinc-200">
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

        {/* Table Body - Scrollable */}
        <div className="flex-1 min-h-0 flex flex-col">
          {rows.length > 0 ? (
            <div className="flex-1 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {rows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`grid items-center px-6 h-14 text-black text-sm font-medium leading-none hover:bg-zinc-50 transition-colors ${onClick ? "cursor-pointer" : ""} ${
                      index < rows.length - 1 ? "border-b border-zinc-200" : ""
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

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex-shrink-0 flex justify-center p-4 border-t border-zinc-200">
                  <Button
                    variant="default"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                        Loading more...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 flex items-center justify-center text-center h-14 bg-white border border-zinc-200 rounded-xl text-black text-sm font-medium">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                noResultsMessage
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500">Error loading tickets</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full flex-col justify-start min-h-0">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 h-24">
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

      {/* Content - Scrollable */}
      <div className="flex-1 min-h-0 px-4 lg:px-6 pb-4">
        {renderTableContent((row) => {
          router.navigate({
            to:
              character === "user" ? `/user/tickets/$id` : `/staff/tickets/$id`,
            params: { id: row.id },
          });
        })}
      </div>

      {transferModal}
      {updateStatusModal}
      {raiseReqModal}
    </div>
  );
}
