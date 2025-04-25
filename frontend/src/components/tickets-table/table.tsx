'use client';

import { useState } from 'react';

import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	type UniqueIdentifier,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
	SortableContext,
	arrayMove,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
} from '@tanstack/react-table';
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	ClipboardListIcon,
	ClockIcon,
	ColumnsIcon,
	GripVerticalIcon,
	Loader2Icon,
	MoreVerticalIcon,
	PlusIcon,
	UserRoundPlusIcon,
} from 'lucide-react';
import * as React from 'react';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePriorityModal } from '@/hooks/use-priority-modal';
import { useRequirementsModal } from '@/hooks/use-requirements-modal';
import { useSolutionModal } from '@/hooks/use-solution-modal';
// Import the hooks
import { useTransferModal } from '@/hooks/use-transfer-modal';
import type { getUserTickets } from '@/lib/db';
import { DraggableRow, TableCellViewer } from './comp';

type TicketType = Awaited<ReturnType<typeof getUserTickets>>[number];

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
	const { attributes, listeners } = useSortable({
		id,
	});

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
	);
}

function getStatusIcon(status: string) {
	switch (status) {
		case 'Completed':
			return (
				<CheckCircle2Icon className="text-green-500 dark:text-green-400" />
			);
		case 'In Progress':
			return <Loader2Icon className="text-amber-500 dark:text-amber-400" />;
		case 'Pending':
			return <ClockIcon className="text-blue-500 dark:text-blue-400" />;
		case 'Scheduled':
			return <ClockIcon className="text-purple-500 dark:text-purple-400" />;
		default:
			return <AlertTriangleIcon className="text-red-500 dark:text-red-400" />;
	}
}

function getPriorityBadge(priority: string) {
	switch (priority) {
		case 'Critical':
			return <Badge className="bg-red-500 hover:bg-red-600">Critical</Badge>;
		case 'High':
			return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>;
		case 'Medium':
			return <Badge className="bg-amber-500 hover:bg-amber-600">Medium</Badge>;
		case 'Low':
			return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>;
		default:
			return <Badge>{priority}</Badge>;
	}
}

export function DataTable({
	data: initialData,
	character,
}: {
	data: TicketType[];
	character: 'user' | 'staff';
}) {
	const [data, setData] = useState(() => initialData);
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
	const sortableId = React.useId();
	const sensors = useSensors(
		useSensor(MouseSensor, {}),
		useSensor(TouchSensor, {}),
		useSensor(KeyboardSensor, {}),
	);

	const dataIds = React.useMemo<UniqueIdentifier[]>(
		() => data?.map(({ id }) => id) || [],
		[data],
	);

	const handleTransfer = (transferData: {
		ticketId: string;
		assigneeId: string;
		reason: string;
		remarks: string;
	}) => {
		// Get the staff name from the ID (in a real app, you would fetch this from your API)
		const staffName =
			transferData.assigneeId === '1'
				? 'Eddie Lake'
				: transferData.assigneeId === '2'
					? 'Jamik Tashpulatov'
					: transferData.assigneeId === '3'
						? 'Thomas Wilson'
						: transferData.assigneeId === '4'
							? 'Lisa Wong'
							: 'Raj Patel';

		// Update the data
		setData(
			data.map((item) => {
				if (item.id.toString() === transferData.ticketId) {
					return {
						...item,
						assignedTo: staffName,
					};
				}
				return item;
			}),
		);
	};

	const handlePriorityUpdate = (priorityData: {
		ticketId: string;
		priority: string;
		notifyPersonnel: string[];
		reason: string;
	}) => {
		// Update the data
		setData(
			data.map((item) => {
				if (item.id.toString() === priorityData.ticketId) {
					return {
						...item,
						priority:
							priorityData.priority.charAt(0).toUpperCase() +
							priorityData.priority.slice(1),
					};
				}
				return item;
			}),
		);
	};

	const handleSolutionSubmit = (solutionData: {
		ticketId: string;
		solutionType: string;
		description: string;
		addToKnowledgeBase: boolean;
		sendSurvey: boolean;
	}) => {
		// Update the data
		setData(
			data.map((item) => {
				if (item.id.toString() === solutionData.ticketId) {
					return {
						...item,
						status: 'Completed',
						completedDate: new Date().toISOString(),
					};
				}
				return item;
			}),
		);
	};

	// Initialize all modal hooks here, outside the column definition
	const transferModalHooks = data.map((item) =>
		useTransferModal({
			ticketId: item.id.toString(),
			currentAssignee: item.lastAssignedName,
			onTransfer: handleTransfer,
		}),
	);

	const priorityModalHooks = data.map((item) =>
		usePriorityModal({
			ticketId: item.id.toString(),
			currentPriority: item.ticket.priority,
			onSubmit: handlePriorityUpdate,
		}),
	);

	const requirementsModalHooks = data.map((item) =>
		useRequirementsModal({
			ticketId: item.id.toString(),
			onSubmit: () => {},
		}),
	);

	const solutionModalHooks = data.map((item) =>
		useSolutionModal({
			ticketId: item.id.toString(),
			onSubmit: handleSolutionSubmit,
		}),
	);

	const columns = React.useMemo<ColumnDef<TicketType>[]>(() => {
		const baseColumns: ColumnDef<TicketType>[] = [
			{
				id: 'select',
				header: ({ table }) => (
					<div className="flex items-center justify-center">
						<Checkbox
							checked={
								table.getIsAllPageRowsSelected() ||
								(table.getIsSomePageRowsSelected() && 'indeterminate')
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
				accessorKey: 'area',
				header: 'Area',
				cell: ({ row }) => <div>{row.original.ticket.area}</div>,
			},
			{
				accessorKey: 'title',
				header: 'Title',
				cell: ({ row }) => {
					return <div className='text-ellipsis overflow-hidden whitespace-nowrap max-w-52'>{row.original.ticket.title}</div>;
				},
				enableHiding: false,
			},
			{
				accessorKey: 'category',
				header: 'Category',
				cell: ({ row }) => (
					<div className="w-32">
						<Badge variant="outline" className="px-1.5 text-muted-foreground">
							{row.original.ticket.category}
						</Badge>
					</div>
				),
			},
			{
				accessorKey: 'priority',
				header: 'Priority',
				cell: ({ row }) => getPriorityBadge(row.original.ticket.priority),
			},
			{
				accessorKey: 'status',
				header: 'Status',
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3"
					>
						{getStatusIcon(row.original.ticket.status)}
						{row.original.ticket.status}
					</Badge>
				),
			},
			{
				id: 'actions',
				cell: ({ row, table }) => {
					// Get the modal hooks for this row
					const rowIndex = table.getRowModel().rows.indexOf(row);
					const { openModal: openTransferModal, modal: transferModal } =
						transferModalHooks[rowIndex];
					const { openModal: openPriorityModal, modal: priorityModal } =
						priorityModalHooks[rowIndex];
					const { openModal: openRequirementsModal, modal: requirementsModal } =
						requirementsModalHooks[rowIndex];
					const { openModal: openSolutionModal, modal: solutionModal } =
						solutionModalHooks[rowIndex];

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
									{character === 'staff' && (
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
									{character === 'user' && (
										<DropdownMenuItem>Track Progress</DropdownMenuItem>
									)}
									<DropdownMenuSeparator />
									{character === 'staff' ? (
										<DropdownMenuItem>Close Order</DropdownMenuItem>
									) : (
										<DropdownMenuItem>Cancel Request</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					);
				},
			},
		];

		// Add staff-specific columns
		if (character === 'staff') {
			return [
				...baseColumns.slice(0, 2),
				{
					accessorKey: 'submittedBy',
					header: 'Requested By',
					cell: ({ row }) => <div>{row.original.customerName}</div>,
				},
				...baseColumns.slice(2, 5),
				{
					accessorKey: 'assignedTo',
					header: 'Assigned To',
					cell: ({ row }) => {
						const isAssigned = row.original.lastAssignedName !== 'Unassigned';

						if (isAssigned) {
							return row.original.lastAssignedName;
						}

						return <span className="text-muted-foreground">未指派</span>;
					},
				},
				baseColumns[5],
				baseColumns[6],
			];
		}

		// User-specific columns
		return [
			...baseColumns.slice(0, 5),
			{
				accessorKey: 'submittedDate',
				header: 'Submitted',
				cell: ({ row }) => {
					const date = new Date(row.original.createdAt);
					return date.toLocaleDateString();
				},
			},
			baseColumns[5],
			baseColumns[6],
		];
	}, [
		character,
		transferModalHooks,
		priorityModalHooks,
		requirementsModalHooks,
		solutionModalHooks,
	]);

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
	});

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (active && over && active.id !== over.id) {
			setData((data) => {
				const oldIndex = dataIds.indexOf(active.id);
				const newIndex = dataIds.indexOf(over.id);
				return arrayMove(data, oldIndex, newIndex);
			});
		}
	}

	return (
		<Tabs
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
						<SelectItem value="all">
							All {character === 'user' ? 'Requests' : 'Work Orders'}
						</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="in-progress">In Progress</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
					</SelectContent>
				</Select>
				<TabsList className="@4xl/main:flex hidden">
					<TabsTrigger value="all">
						All {character === 'user' ? 'Requests' : 'Work Orders'}
					</TabsTrigger>
					<TabsTrigger value="pending" className="gap-1">
						Pending{' '}
						<Badge
							variant="secondary"
							className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
						>
							4
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="in-progress" className="gap-1">
						In Progress{' '}
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
								.filter(
									(column) =>
										typeof column.accessorFn !== 'undefined' &&
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
					<Button variant="outline" size="sm">
						<PlusIcon />
						<span className="hidden lg:inline">
							{character === 'user' ? 'New Request' : 'Create Work Order'}
						</span>
						<span className="lg:hidden">New</span>
					</Button>
				</div>
			</div>
			<TabsContent
				value="all"
				className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
			>
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
														: flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
												</TableHead>
											);
										})}
									</TableRow>
								))}
							</TableHeader>
							<TableBody className="first:data-[slot=table-cell]:**:w-8">
								{table.getRowModel().rows?.length ? (
									<SortableContext
										items={dataIds}
										strategy={verticalListSortingStrategy}
									>
										{table.getRowModel().rows.map((row) => (
											<DraggableRow key={row.id} row={row} />
										))}
									</SortableContext>
								) : (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center"
										>
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
						{table.getFilteredSelectedRowModel().rows.length} of{' '}
						{table.getFilteredRowModel().rows.length} row(s) selected.
					</div>
					<div className="flex w-full items-center gap-8 lg:w-fit">
						<div className="hidden items-center gap-2 lg:flex">
							<Label htmlFor="rows-per-page" className="text-sm font-medium">
								Rows per page
							</Label>
							<Select
								value={`${table.getState().pagination.pageSize}`}
								onValueChange={(value) => {
									table.setPageSize(Number(value));
								}}
							>
								<SelectTrigger className="w-20" id="rows-per-page">
									<SelectValue
										placeholder={table.getState().pagination.pageSize}
									/>
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
							Page {table.getState().pagination.pageIndex + 1} of{' '}
							{table.getPageCount()}
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
			<TabsContent
				value="pending"
				className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
			>
				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader className="sticky top-0 z-10 bg-muted">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead key={header.id} colSpan={header.colSpan}>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table
								.getRowModel()
								.rows.filter((row) => row.original.ticket.status === 'Pending')
								.map((row) => (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && 'selected'}
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
								))}
							{table
								.getRowModel()
								.rows.filter((row) => row.original.ticket.status === 'Pending')
								.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No pending {character === 'user' ? 'requests' : 'work orders'}.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</TabsContent>
			<TabsContent
				value="in-progress"
				className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
			>
				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader className="sticky top-0 z-10 bg-muted">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead key={header.id} colSpan={header.colSpan}>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table
								.getRowModel()
								.rows.filter((row) => row.original.ticket.status === 'In Progress')
								.map((row) => (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && 'selected'}
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
								))}
							{table
								.getRowModel()
								.rows.filter((row) => row.original.ticket.status === 'In Progress')
								.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No in-progress{' '}
										{character === 'user' ? 'requests' : 'work orders'}.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</TabsContent>
			<TabsContent
				value="completed"
				className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
			>
				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader className="sticky top-0 z-10 bg-muted">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead key={header.id} colSpan={header.colSpan}>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table
								.getRowModel()
								.rows.filter((row) => row.original.ticket.status === 'Resolved')
								.map((row) => (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && 'selected'}
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
								))}
							{table
								.getRowModel()
								.rows.filter((row) => row.original.ticket.status === 'Resolved')
								.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No completed {character === 'user' ? 'requests' : 'work orders'}.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</TabsContent>
		</Tabs>
	);
}
