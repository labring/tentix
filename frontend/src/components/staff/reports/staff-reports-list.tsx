import { useState } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react"
import { Button } from "tentix-ui"
import { Checkbox } from "tentix-ui"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "tentix-ui"
import { Input } from "tentix-ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "tentix-ui"
import { Badge } from "tentix-ui"

export type Report = {
  id: string
  title: string
  category: string
  priority: "low" | "medium" | "high" | "critical"
  status: "pending" | "in-progress" | "resolved"
  createdBy: string
  createdAt: string
  updatedAt: string
}

const data: Report[] = [
  {
    id: "ISSUE-1234",
    title: "用户登录页面无法加载",
    category: "系统错误",
    priority: "high",
    status: "in-progress",
    createdBy: "张三",
    createdAt: "2023-04-15T09:24:00",
    updatedAt: "2023-04-15T14:30:00",
  },
  {
    id: "ISSUE-1235",
    title: "数据库连接超时",
    category: "性能问题",
    priority: "critical",
    status: "pending",
    createdBy: "李四",
    createdAt: "2023-04-14T16:42:00",
    updatedAt: "2023-04-14T16:42:00",
  },
  {
    id: "ISSUE-1236",
    title: "报表导出功能失效",
    category: "功能错误",
    priority: "medium",
    status: "resolved",
    createdBy: "王五",
    createdAt: "2023-04-13T11:20:00",
    updatedAt: "2023-04-14T09:15:00",
  },
  {
    id: "ISSUE-1237",
    title: "移动端界面显示异常",
    category: "UI/UX问题",
    priority: "low",
    status: "resolved",
    createdBy: "赵六",
    createdAt: "2023-04-12T14:50:00",
    updatedAt: "2023-04-13T10:30:00",
  },
  {
    id: "ISSUE-1238",
    title: "用户权限验证失败",
    category: "安全漏洞",
    priority: "high",
    status: "in-progress",
    createdBy: "张三",
    createdAt: "2023-04-11T09:15:00",
    updatedAt: "2023-04-11T16:20:00",
  },
  {
    id: "ISSUE-1239",
    title: "第三方API集成失败",
    category: "集成问题",
    priority: "medium",
    status: "pending",
    createdBy: "李四",
    createdAt: "2023-04-10T13:40:00",
    updatedAt: "2023-04-10T13:40:00",
  },
  {
    id: "ISSUE-1240",
    title: "通知系统发送延迟",
    category: "性能问题",
    priority: "low",
    status: "resolved",
    createdBy: "王五",
    createdAt: "2023-04-09T10:30:00",
    updatedAt: "2023-04-10T09:45:00",
  },
  {
    id: "ISSUE-1241",
    title: "文件上传功能中断",
    category: "系统错误",
    priority: "high",
    status: "in-progress",
    createdBy: "赵六",
    createdAt: "2023-04-08T15:20:00",
    updatedAt: "2023-04-09T11:10:00",
  },
  {
    id: "ISSUE-1242",
    title: "搜索功能返回错误结果",
    category: "功能错误",
    priority: "medium",
    status: "pending",
    createdBy: "张三",
    createdAt: "2023-04-07T09:30:00",
    updatedAt: "2023-04-07T09:30:00",
  },
  {
    id: "ISSUE-1243",
    title: "系统自动登出问题",
    category: "安全漏洞",
    priority: "low",
    status: "resolved",
    createdBy: "李四",
    createdAt: "2023-04-06T14:15:00",
    updatedAt: "2023-04-07T10:20:00",
  },
]

export const columns: ColumnDef<Report>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "编号",
    cell: ({ row }) => <div className="font-medium">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          标题
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div>{row.getValue("title")}</div>,
  },
  {
    accessorKey: "category",
    header: "类别",
    cell: ({ row }) => <div>{row.getValue("category")}</div>,
  },
  {
    accessorKey: "priority",
    header: "优先级",
    cell: ({ row }) => {
      const priority = row.getValue("priority") as string

      return (
        <Badge
          variant="outline"
          className={
            priority === "critical"
              ? "border-red-500 text-red-500"
              : priority === "high"
                ? "border-orange-500 text-orange-500"
                : priority === "medium"
                  ? "border-yellow-500 text-yellow-500"
                  : "border-green-500 text-green-500"
          }
        >
          {priority === "critical" ? "紧急" : priority === "high" ? "高" : priority === "medium" ? "中" : "低"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const status = row.getValue("status") as string

      return (
        <Badge
          variant="outline"
          className={
            status === "pending"
              ? "border-blue-500 bg-blue-50 text-blue-500"
              : status === "in-progress"
                ? "border-amber-500 bg-amber-50 text-amber-500"
                : "border-green-500 bg-green-50 text-green-500"
          }
        >
          {status === "pending" ? "待处理" : status === "in-progress" ? "处理中" : "已解决"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdBy",
    header: "创建人",
    cell: ({ row }) => <div>{row.getValue("createdBy")}</div>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          创建时间
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"))
      return <div>{date.toLocaleString("zh-CN")}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const report = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">打开菜单</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(report.id)}>复制编号</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>查看详情</DropdownMenuItem>
            <DropdownMenuItem>编辑报告</DropdownMenuItem>
            <DropdownMenuItem>更改状态</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">删除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

interface StaffReportsListProps {
  status: "all" | "pending" | "in-progress" | "resolved"
}

export function StaffReportsList({ status }: StaffReportsListProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  // 根据状态筛选数据
  const filteredData = status === "all" ? data : data.filter((report) => report.status === status)

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="搜索问题..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("title")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              显示列 <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id === "id"
                      ? "编号"
                      : column.id === "title"
                        ? "标题"
                        : column.id === "category"
                          ? "类别"
                          : column.id === "priority"
                            ? "优先级"
                            : column.id === "status"
                              ? "状态"
                              : column.id === "createdBy"
                                ? "创建人"
                                : column.id === "createdAt"
                                  ? "创建时间"
                                  : column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  没有找到结果
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          已选择 {table.getFilteredSelectedRowModel().rows.length} 个问题，共 {table.getFilteredRowModel().rows.length}{" "}
          个
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            上一页
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
