import { updateTicketStatus } from "@lib/query";
import { allTicketsQueryOptions } from "@lib/query";
import { useRaiseReqModal } from "@modal/use-raise-req-modal.tsx";
import { useTransferModal } from "@modal/use-transfer-modal.tsx";
import { useUpdateStatusModal } from "@modal/use-update-status-modal.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { joinTrans, useTranslation } from "i18n";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ClipboardListIcon, ColumnsIcon, MoreVerticalIcon,
  PlusIcon,
  Settings2,
  UserRoundPlusIcon,
  Loader2Icon
} from "lucide-react";
import * as React from "react";
import { useState, useCallback } from "react";
import { type TicketsAllListItemType } from "tentix-server/rpc";
import {
  Badge, Button, Checkbox, DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger, Label,
  PriorityBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow, Tabs, TabsList,
  TabsTrigger,
  toast
} from "tentix-ui";


export function DataTable({
  character,
}: {
  character: "user" | "staff";
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Fetch data using useQuery
  const { data, isLoading, error } = useQuery(allTicketsQueryOptions());

  const { openTransferModal, transferModal } = useTransferModal();
  const { updateStatusModal, openUpdateStatusModal } = useUpdateStatusModal();
  const { raiseReqModal, openRaiseReqModal } = useRaiseReqModal();

  // Close ticket mutation
  const closeTicketMutation = useMutation({
    mutationFn: updateTicketStatus,
    onSuccess: (response) => {
      toast({
        title: t("success"),
        description: response.message || t("ticket_closed"),
        variant: "default",
      });
      // Invalidate getAllTickets query to refresh data
      queryClient.invalidateQueries({
        queryKey: ["getAllTickets"],
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
              to={character === "user" ? `/user/tickets/$id` : `/staff/tickets/$id`}
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
                      <DropdownMenuItem
                        onClick={(e) => handleCloseTicket(ticketId, e)}
                      >
                        <CheckCircle2Icon className="mr-2 h-4 w-4" />
                        {t("mark_as_solved")}
                      </DropdownMenuItem>
                    </>
                  )}
                  {/* {character === "user" && (
                    <DropdownMenuItem>Track Progress</DropdownMenuItem>
                  )} */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleCloseTicket(ticketId, e)}
                  >
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

    // User-specific columns
    return baseColumns;
  }, [
    character,
    t,
    openTransferModal,
    openUpdateStatusModal,
    openRaiseReqModal,
    handleCloseTicket,
    router,
  ]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualFiltering: false,
  });



  const getStatusCounts = React.useMemo(() => {
    if (!data) {
      return {
        pending: 0,
        inProgress: 0,
        completed: 0,
        scheduled: 0,
      };
    }
    return {
      pending: data.filter((item) => item.status === "pending").length,
      inProgress: data.filter((item) => item.status === "in_progress").length,
      completed: data.filter((item) => item.status === "resolved").length,
      scheduled: data.filter((item) => item.status === "scheduled").length,
    };
  }, [data]);

  const [tabValue, setTabValue] = useState<
    TicketsAllListItemType["status"] | "all"
  >("all");

  React.useEffect(() => {
    table.setPageIndex(0);
    if (tabValue !== "all") {
      table.getColumn("status")?.setFilterValue(tabValue);
    } else {
      table.setColumnFilters([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue]);

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2Icon className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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

  const renderTableContent = (filteredStatus: typeof tabValue) => {
    const filteredRows = table.getRowModel().rows;

    const noResultsMessage =
      filteredStatus !== "all"
        ? `No ${filteredStatus.toLowerCase()} ${character === "user" ? "requests" : "work orders"}.`
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
          <TableBody
            className={
              !filteredStatus ? "first:data-[slot=table-cell]:**:w-8" : ""
            }
          >
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => (
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
                  {noResultsMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  // 提取分页控件到独立组件
  const renderPagination = () => (
    <div className="flex items-center justify-between px-4">
      <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
        {t("rows_selected_one", {
          selected: table.getFilteredSelectedRowModel().rows.length,
          all: table.getFilteredRowModel().rows.length,
        })}
      </div>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            {t("rows_per_page")}
          </Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="w-20" id="rows-per-page">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t("page_number", {
            page: table.getState().pagination.pageIndex + 1,
            all: table.getPageCount(),
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t("go_to_first_page")}</span>
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t("go_to_previous_page")}</span>
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            className="size-8"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t("go_to_next_page")}</span>
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 lg:flex"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t("go_to_last_page")}</span>
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );

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

  return (
    <Tabs
      value={tabValue}
      onValueChange={(value) => {
        setTabValue(value as typeof tabValue);
        table.resetPageIndex();
      }}
      defaultValue="all"
      className="flex w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="all">
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
            {`${t("pending")  } `}
            <StatusTabBadge count={getStatusCounts.pending} />
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1">
            {`${t("in_progress")  } `}
            <StatusTabBadge count={getStatusCounts.inProgress} />
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1">
            {`${t("completed")  } `}
            <StatusTabBadge count={getStatusCounts.completed} />
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-1">
            {`${t("scheduled")  } `}
            <StatusTabBadge count={getStatusCounts.scheduled} />
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
        {renderTableContent(tabValue)}
        {renderPagination()}
      </div>

      {transferModal}
      {updateStatusModal}
      {raiseReqModal}
    </Tabs>
  );
}
