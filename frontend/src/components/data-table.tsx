import { useState } from "react"

import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
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
} from "@tanstack/react-table"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ClockIcon,
  ColumnsIcon,
  GripVerticalIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PlusIcon,
  CheckCircle2Icon,
  UserRoundPlusIcon,
  ClipboardListIcon,
} from "lucide-react"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ChartConfig } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Import the hooks
import { useTransferModal } from "@/hooks/use-transfer-modal"
import { useRequirementsModal } from "@/hooks/use-requirements-modal"
import { usePriorityModal } from "@/hooks/use-priority-modal"
import { useSolutionModal } from "@/hooks/use-solution-modal"

export const schema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  priority: z.string(),
  status: z.string(),
  submittedBy: z.string(),
  submittedDate: z.string(),
  assignedTo: z.string(),
  estimatedCompletion: z.string(),
  location: z.string(),
  completedDate: z.string().optional(),
})

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Completed":
      return <CheckCircle2Icon className="text-green-500 dark:text-green-400" />
    case "In Progress":
      return <Loader2Icon className="text-amber-500 dark:text-amber-400" />
    case "Pending":
      return <ClockIcon className="text-blue-500 dark:text-blue-400" />
    case "Scheduled":
      return <ClockIcon className="text-purple-500 dark:text-purple-400" />
    default:
      return <AlertTriangleIcon className="text-red-500 dark:text-red-400" />
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "Critical":
      return <Badge className="bg-red-500 hover:bg-red-600">Critical</Badge>
    case "High":
      return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>
    case "Medium":
      return <Badge className="bg-amber-500 hover:bg-amber-600">Medium</Badge>
    case "Low":
      return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>
    default:
      return <Badge>{priority}</Badge>
  }
}

export function DataTable({
  data: initialData,
  role,
}: {
  data: z.infer<typeof schema>[]
  role: "user" | "staff"
}) {
  const [data, setData] = useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}))

  const dataIds = React.useMemo<UniqueIdentifier[]>(() => data?.map(({ id }) => id) || [], [data])

  const handleTransfer = (transferData: { ticketId: string; assigneeId: string; reason: string; remarks: string }) => {
    // Get the staff name from the ID (in a real app, you would fetch this from your API)
    const staffName =
      transferData.assigneeId === "1"
        ? "Eddie Lake"
        : transferData.assigneeId === "2"
          ? "Jamik Tashpulatov"
          : transferData.assigneeId === "3"
            ? "Thomas Wilson"
            : transferData.assigneeId === "4"
              ? "Lisa Wong"
              : "Raj Patel"

    // Update the data
    setData(
      data.map((item) => {
        if (item.id.toString() === transferData.ticketId) {
          return {
            ...item,
            assignedTo: staffName,
          }
        }
        return item
      }),
    )
  }

  const handlePriorityUpdate = (priorityData: {
    ticketId: string
    priority: string
    notifyPersonnel: string[]
    reason: string
  }) => {
    // Update the data
    setData(
      data.map((item) => {
        if (item.id.toString() === priorityData.ticketId) {
          return {
            ...item,
            priority: priorityData.priority.charAt(0).toUpperCase() + priorityData.priority.slice(1),
          }
        }
        return item
      }),
    )
  }

  const handleSolutionSubmit = (solutionData: {
    ticketId: string
    solutionType: string
    description: string
    addToKnowledgeBase: boolean
    sendSurvey: boolean
  }) => {
    // Update the data
    setData(
      data.map((item) => {
        if (item.id.toString() === solutionData.ticketId) {
          return {
            ...item,
            status: "Completed",
            completedDate: new Date().toISOString(),
          }
        }
        return item
      }),
    )
  }

  // Initialize all modal hooks here, outside the column definition
  const transferModalHooks = data.map((item) =>
    useTransferModal({
      ticketId: item.id.toString(),
      currentAssignee: item.assignedTo,
      onTransfer: handleTransfer,
    }),
  )

  const priorityModalHooks = data.map((item) =>
    usePriorityModal({
      ticketId: item.id.toString(),
      currentPriority: item.priority,
      onSubmit: handlePriorityUpdate,
    }),
  )

  const requirementsModalHooks = data.map((item) =>
    useRequirementsModal({
      ticketId: item.id.toString(),
      onSubmit: () => {},
    }),
  )

  const solutionModalHooks = data.map((item) =>
    useSolutionModal({
      ticketId: item.id.toString(),
      onSubmit: handleSolutionSubmit,
    }),
  )

  const columns = React.useMemo<ColumnDef<z.infer<typeof schema>>[]>(() => {
    const baseColumns: ColumnDef<z.infer<typeof schema>>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          return (
            <TableCellViewer
              item={row.original}
              role={role}
              handleTransfer={handleTransfer}
              handlePriorityUpdate={handlePriorityUpdate}
              handleSolutionSubmit={handleSolutionSubmit}
              ticketId={row.original.id.toString()} // Pass the ticketId
              currentAssignee={row.original.assignedTo} // Pass the currentAssignee
              currentPriority={row.original.priority} // Pass the currentPriority
              transferModalHooks={transferModalHooks}
              priorityModalHooks={priorityModalHooks}
              requirementsModalHooks={requirementsModalHooks}
              solutionModalHooks={solutionModalHooks}
              rowIndex={table.getRowModel().rows.indexOf(row)}
            />
          )
        },
        enableHiding: false,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <div className="w-32">
            <Badge variant="outline" className="px-1.5 text-muted-foreground">
              {row.original.category}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => getPriorityBadge(row.original.priority),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline" className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3">
            {getStatusIcon(row.original.status)}
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => <div>{row.original.location}</div>,
      },
      {
        id: "actions",
        cell: ({ row, table }) => {
          // Get the modal hooks for this row
          const rowIndex = table.getRowModel().rows.indexOf(row)
          const { openModal: openTransferModal, modal: transferModal } = transferModalHooks[rowIndex]
          const { openModal: openPriorityModal, modal: priorityModal } = priorityModalHooks[rowIndex]
          const { openModal: openRequirementsModal, modal: requirementsModal } = requirementsModalHooks[rowIndex]
          const { openModal: openSolutionModal, modal: solutionModal } = solutionModalHooks[rowIndex]

          return (
            <>
              {transferModal}
              {priorityModal}
              {requirementsModal}
              {solutionModal}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                    size="icon"
                  >
                    <MoreVerticalIcon />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>View Details</DropdownMenuItem>
                  {role === "staff" && (
                    <>
                      <DropdownMenuItem>Update Status</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={openTransferModal}>
                        <UserRoundPlusIcon className="mr-2 h-4 w-4" />
                        Transfer
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openPriorityModal}>
                        <AlertTriangleIcon className="mr-2 h-4 w-4" />
                        Adjust Priority
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openRequirementsModal}>
                        <ClipboardListIcon className="mr-2 h-4 w-4" />
                        Raise Requirements
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={openSolutionModal}>
                        <CheckCircle2Icon className="mr-2 h-4 w-4" />
                        Mark as Solved
                      </DropdownMenuItem>
                    </>
                  )}
                  {role === "user" && <DropdownMenuItem>Track Progress</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  {role === "staff" ? (
                    <DropdownMenuItem>Close Order</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem>Cancel Request</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )
        },
      },
    ]

    // Add staff-specific columns
    if (role === "staff") {
      return [
        ...baseColumns.slice(0, 2),
        {
          accessorKey: "submittedBy",
          header: "Requested By",
          cell: ({ row }) => <div>{row.original.submittedBy}</div>,
        },
        ...baseColumns.slice(2, 5),
        {
          accessorKey: "assignedTo",
          header: "Assigned To",
          cell: ({ row }) => {
            const isAssigned = row.original.assignedTo !== "Unassigned"

            if (isAssigned) {
              return row.original.assignedTo
            }

            return <span className="text-muted-foreground">未指派</span>
          },
        },
        baseColumns[5],
        {
          accessorKey: "estimatedCompletion",
          header: "Due Date",
          cell: ({ row }) => {
            const date = new Date(row.original.estimatedCompletion)
            return date.toLocaleDateString()
          },
        },
        baseColumns[6],
      ]
    }

    // User-specific columns
    return [
      ...baseColumns.slice(0, 5),
      {
        accessorKey: "submittedDate",
        header: "Submitted",
        cell: ({ row }) => {
          const date = new Date(row.original.submittedDate)
          return date.toLocaleDateString()
        },
      },
      baseColumns[5],
      baseColumns[6],
    ]
  }, [role, transferModalHooks, priorityModalHooks, requirementsModalHooks, solutionModalHooks])

  const table = useReactTable({
    data,
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
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs defaultValue="all" className="flex w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="all">
          <SelectTrigger className="@4xl/main:hidden flex w-fit" id="view-selector">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {role === "user" ? "Requests" : "Work Orders"}</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="@4xl/main:flex hidden">
          <TabsTrigger value="all">All {role === "user" ? "Requests" : "Work Orders"}</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            Pending{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              4
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="gap-1">
            In Progress{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              8
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <PlusIcon />
            <span className="hidden lg:inline">{role === "user" ? "New Request" : "Create Work Order"}</span>
            <span className="lg:hidden">New</span>
          </Button>
        </div>
      </div>
      <TabsContent value="all" className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="first:data-[slot=table-cell]:**:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
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
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="pending" className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table
                .getRowModel()
                .rows.filter((row) => row.original.status === "Pending")
                .map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              {table.getRowModel().rows.filter((row) => row.original.status === "Pending").length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No pending {role === "user" ? "requests" : "work orders"}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="in-progress" className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table
                .getRowModel()
                .rows.filter((row) => row.original.status === "In Progress")
                .map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              {table.getRowModel().rows.filter((row) => row.original.status === "In Progress").length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No in-progress {role === "user" ? "requests" : "work orders"}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="completed" className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table
                .getRowModel()
                .rows.filter((row) => row.original.status === "Completed")
                .map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              {table.getRowModel().rows.filter((row) => row.original.status === "Completed").length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No completed {role === "user" ? "requests" : "work orders"}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
      ))}
    </TableRow>
  )
}

const chartData = [
  { month: "January", submitted: 18, completed: 15 },
  { month: "February", submitted: 22, completed: 19 },
  { month: "March", submitted: 17, completed: 16 },
  { month: "April", submitted: 25, completed: 21 },
  { month: "May", submitted: 30, completed: 26 },
  { month: "June", submitted: 28, completed: 24 },
]

const chartConfig = {
  submitted: {
    label: "Submitted",
    color: "var(--primary)",
  },
  completed: {
    label: "Completed",
    color: "var(--primary)",
  },
} satisfies ChartConfig

// Update the TableCellViewer component to use the hooks
function TableCellViewer({
  item,
  role,
  handleTransfer,
  handlePriorityUpdate,
  handleSolutionSubmit,
  ticketId, // Receive the ticketId
  currentAssignee, // Receive the currentAssignee
  currentPriority, // Receive the currentPriority
  transferModalHooks,
  priorityModalHooks,
  requirementsModalHooks,
  solutionModalHooks,
  rowIndex,
}: {
  item: z.infer<typeof schema>
  role: "user" | "staff"
  handleTransfer: any
  handlePriorityUpdate: any
  handleSolutionSubmit: any
  ticketId: string // Define the type for ticketId
  currentAssignee: string // Define the type for currentAssignee
  currentPriority: string // Define the type for currentPriority
  transferModalHooks: any
  priorityModalHooks: any
  requirementsModalHooks: any
  solutionModalHooks: any
  rowIndex: number
}) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  const { openModal: openTransferModal, modal: transferModal } = transferModalHooks[rowIndex]
  const { openModal: openPriorityModal, modal: priorityModal } = priorityModalHooks[rowIndex]
  const { openModal: openRequirementsModal, modal: requirementsModal } = requirementsModalHooks[rowIndex]
  const { openModal: openSolutionModal, modal: solutionModal } = solutionModalHooks[rowIndex]

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {transferModal}
      {priorityModal}
      {requirementsModal}
      {solutionModal}
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {item.title}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader className="gap-1">
          <SheetTitle>{item.title}</SheetTitle>
          <SheetDescription>
            {role === "user" ? "Request" : "Work Order"} #{item.id} • {item.category}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
          {!isMobile && (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3">
                  {getStatusIcon(item.status)}
                  {item.status}
                </Badge>
                {getPriorityBadge(item.priority)}
              </div>
              <Separator />
            </>
          )}
          <div className="grid gap-2">
            <div className="font-medium">Description</div>
            <div className="text-muted-foreground">{item.description}</div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-medium">Submitted By</div>
              <div className="text-muted-foreground">{item.submittedBy}</div>
            </div>
            <div>
              <div className="font-medium">Submitted Date</div>
              <div className="text-muted-foreground">{new Date(item.submittedDate).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-medium">Location</div>
              <div className="text-muted-foreground">{item.location}</div>
            </div>
            <div>
              <div className="font-medium">Assigned To</div>
              <div className="text-muted-foreground">{item.assignedTo}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-medium">Due Date</div>
              <div className="text-muted-foreground">{new Date(item.estimatedCompletion).toLocaleDateString()}</div>
            </div>
            {item.completedDate && (
              <div>
                <div className="font-medium">Completed Date</div>
                <div className="text-muted-foreground">{new Date(item.completedDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>
          <Separator />
          {role === "staff" && (
            <>
              <div className="flex flex-col gap-3">
                <div className="font-medium">Actions</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={openTransferModal}>
                    <UserRoundPlusIcon className="h-4 w-4" />
                    Transfer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200 hover:bg-linear-to-r hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-200 shadow-xs"
                    onClick={openRequirementsModal}
                  >
                    <ClipboardListIcon className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-700">Raise Requirements</span>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={openPriorityModal}>
                    <AlertTriangleIcon className="h-4 w-4" />
                    Adjust Priority
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={openSolutionModal}>
                    <CheckCircle2Icon className="h-4 w-4" />
                    Mark as Solved
                  </Button>
                </div>
              </div>
              <Separator />
            </>
          )}
        </div>
        <SheetFooter className="mt-auto flex gap-2 sm:flex-col sm:space-x-0">
          <SheetClose asChild>
            <Button className="w-full">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
