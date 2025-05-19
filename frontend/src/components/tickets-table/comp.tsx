'use client';

import { useState } from 'react';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Row, flexRender } from '@tanstack/react-table';
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	ClipboardListIcon,
	UserRoundPlusIcon,
} from 'lucide-react';
import { z } from 'zod';

import { Badge } from 'tentix-ui';
import { Button } from 'tentix-ui';
import type { ChartConfig } from 'tentix-ui';
import { Separator } from 'tentix-ui';
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from 'tentix-ui';
import { TableCell, TableRow } from 'tentix-ui';
import { useIsMobile } from 'tentix-ui';
// Import the hooks

export function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
	const { transform, transition, setNodeRef, isDragging } = useSortable({
		id: row.original.id,
	});

	return (
		<TableRow
			data-state={row.getIsSelected() && 'selected'}
			data-dragging={isDragging}
			ref={setNodeRef}
			className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
			style={{
				transform: CSS.Transform.toString(transform),
				transition: transition,
			}}
		>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id}>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			))}
		</TableRow>
	);
}

const chartData = [
	{ month: 'January', submitted: 18, completed: 15 },
	{ month: 'February', submitted: 22, completed: 19 },
	{ month: 'March', submitted: 17, completed: 16 },
	{ month: 'April', submitted: 25, completed: 21 },
	{ month: 'May', submitted: 30, completed: 26 },
	{ month: 'June', submitted: 28, completed: 24 },
];

const chartConfig = {
	submitted: {
		label: 'Submitted',
		color: 'var(--primary)',
	},
	completed: {
		label: 'Completed',
		color: 'var(--primary)',
	},
} satisfies ChartConfig;

// Update the TableCellViewer component to use the hooks
export function TableCellViewer({
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
	item: z.infer<typeof schema>;
	role: 'user' | 'staff';
	handleTransfer: any;
	handlePriorityUpdate: any;
	handleSolutionSubmit: any;
	ticketId: string; // Define the type for ticketId
	currentAssignee: string; // Define the type for currentAssignee
	currentPriority: string; // Define the type for currentPriority
	transferModalHooks: any;
	priorityModalHooks: any;
	requirementsModalHooks: any;
	solutionModalHooks: any;
	rowIndex: number;
}) {
	const isMobile = useIsMobile();
	const [isOpen, setIsOpen] = useState(false);

	const { openModal: openTransferModal, modal: transferModal } =
		transferModalHooks[rowIndex];
	const { openModal: openPriorityModal, modal: priorityModal } =
		priorityModalHooks[rowIndex];
	const { openModal: openRequirementsModal, modal: requirementsModal } =
		requirementsModalHooks[rowIndex];
	const { openModal: openSolutionModal, modal: solutionModal } =
		solutionModalHooks[rowIndex];

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
						{role === 'user' ? 'Request' : 'Work Order'} #{item.id} •{' '}
						{item.category}
					</SheetDescription>
				</SheetHeader>
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
					{!isMobile && (
						<>
							<div className="flex items-center justify-between">
								<Badge
									variant="outline"
									className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3"
								>
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
							<div className="text-muted-foreground">
								{new Date(item.submittedDate).toLocaleDateString()}
							</div>
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
							<div className="text-muted-foreground">
								{new Date(item.estimatedCompletion).toLocaleDateString()}
							</div>
						</div>
						{item.completedDate && (
							<div>
								<div className="font-medium">Completed Date</div>
								<div className="text-muted-foreground">
									{new Date(item.completedDate).toLocaleDateString()}
								</div>
							</div>
						)}
					</div>
					<Separator />
					{role === 'staff' && (
						<>
							<div className="flex flex-col gap-3">
								<div className="font-medium">Actions</div>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5"
										onClick={openTransferModal}
									>
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
										<span className="font-medium text-blue-700">
											Raise Requirements
										</span>
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5"
										onClick={openPriorityModal}
									>
										<AlertTriangleIcon className="h-4 w-4" />
										Adjust Priority
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5"
										onClick={openSolutionModal}
									>
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
	);
}
