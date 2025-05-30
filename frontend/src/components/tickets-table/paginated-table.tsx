import { apiClient } from "@lib/api-client";
import { useRaiseReqModal } from "@modal/use-raise-req-modal.tsx";
import { useTransferModal } from "@modal/use-transfer-modal.tsx";
import { useUpdateStatusModal } from "@modal/use-update-status-modal.tsx";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { joinTrans, useTranslation } from "i18n";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardListIcon,
  ColumnsIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PlusIcon,
  Settings2,
  UserRoundPlusIcon,
} from "lucide-react";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { type TicketsAllListItemType } from "tentix-server/rpc";
import {
  Badge, Button, Checkbox, DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger, Label, PriorityBadge, Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, StatusBadge, Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow, Tabs, TabsList, TabsTrigger
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

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pageSize] = useState(40);
  const [tabValue, setTabValue] = useState<
    TicketsAllListItemType["status"] | "all"
  >("all");

  const { openTransferModal, transferModal } = useTransferModal();
  const { updateStatusModal, openUpdateStatusModal } = useUpdateStatusModal();
  const { raiseReqModal, openRaiseReqModal } = useRaiseReqModal();

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


  const columns = React.useMemo<ColumnDef<TicketsAllListItemType>[]>(() => {
    const baseColumns: ColumnDef<TicketsAllListItemType>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected?.() || false}
              onCheckedChange={(value) => row.toggleSelected?.(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "id",
        header: t("id"),
        cell: ({ row }) => <div>{row.original.id}</div>,
      },
      {
        accessorKey: "title",
        header: t("title"),
        cell: ({ row }) => {
          return (
            <Link
              className="text-ellipsis overflow-hidden whitespace-nowrap max-w-192 block hover:underline hover:text-primary"
              to={
                character === "user"
                  ? `/user/tickets/$id`
                  : `/staff/tickets/$id`
              }
              params={{ id: row.original.id }}
            >
              {row.original.title}
            </Link>
          );
        },
        enableHiding: false,
      },
      {
        accessorKey: "area",
        header: t("area"),
        cell: ({ row }) => <div>{row.original.area}</div>,
      },
      {
        accessorKey: "submittedDate",
        header: t("sbmt_date"),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return date.toLocaleDateString();
        },
      },
      {
        accessorKey: "category",
        header: t("category"),
        cell: ({ row }) => (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            {t(row.original.category)}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: t("priority"),
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const ticket = row.original;
          const ticketId = ticket.id;
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
                    <MoreVerticalIcon />
                    <span className="sr-only">{t("open_menu")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() =>
                      router.navigate({
                        to: `/${character}/tickets/${ticketId}`,
                      })
                    }
                  >
                    {t("view_details")}
                  </DropdownMenuItem>
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
                      <DropdownMenuItem onClick={() => console.log(ticketId)}>
                        <CheckCircle2Icon className="mr-2 h-4 w-4" />
                        {t("mark_as_solved")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
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
      baseColumns.splice(3, 0, {
        accessorKey: "submittedBy",
        header: t("rqst_by"),
        cell: ({ row }) => <div>{row.original.customer.nickname}</div>,
      });
    }

    return baseColumns;
  }, [
    character,
    t,
    openTransferModal,
    openUpdateStatusModal,
    openRaiseReqModal,
    router,
  ]);

  const table = useReactTable({
    data: filteredTickets,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualFiltering: false,
    manualPagination: true,
  });

  // Reset when tab changes
  useEffect(() => {
    setRowSelection({});
  }, [tabValue]);

  const StatusTabBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;

    return (
      <Badge
        variant="secondary"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
      >
        {count}
      </Badge>
    );
  };

  const renderTableContent = () => {
    const rows = table.getRowModel().rows;
    const noResultsMessage =
      tabValue !== "all"
        ? `No ${tabValue.toLowerCase()} ${character === "user" ? "requests" : "work orders"}.`
        : t("no_results");

    return (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </div>
                  ) : (
                    noResultsMessage
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="flex justify-center p-4 border-t">
            <Button
              variant="outline"
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
    <Tabs
      value={tabValue}
      onValueChange={(value) => {
        setTabValue(value as typeof tabValue);
      }}
      defaultValue="all"
      className="flex w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select
          value={tabValue}
          onValueChange={(value) => setTabValue(value as typeof tabValue)}
        >
          <SelectTrigger
            className="@4xl/main:hidden flex w-fit"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="in_progress">{t("in_progress")}</SelectItem>
            <SelectItem value="resolved">{t("completed")}</SelectItem>
            <SelectItem value="scheduled">{t("scheduled")}</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="@4xl/main:flex hidden">
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            {`${t("pending")} `}
            <StatusTabBadge count={stats.pending} />
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1">
            {`${t("in_progress")} `}
            <StatusTabBadge count={stats.inProgress} />
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1">
            {`${t("completed")} `}
            <StatusTabBadge count={stats.resolved} />
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-1">
            {`${t("scheduled")} `}
            <StatusTabBadge count={stats.scheduled} />
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">
                  {t("customize_columns")}
                </span>
                <span className="lg:hidden">{t("columns")}</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide(),
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          {character === "user" && (
            <Link to="/user/newticket">
              <Button variant="outline" size="sm">
                <PlusIcon />
                <span className="hidden lg:inline">
                  {joinTrans([t("create"), t("tkt_one")])}
                </span>
                <span className="lg:hidden">{t("create")}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        {renderTableContent()}
      </div>

      {transferModal}
      {updateStatusModal}
      {raiseReqModal}
    </Tabs>
  );
}
