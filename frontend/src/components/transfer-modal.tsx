import type React from "react"

import { useState } from "react"
import { UserRoundPlusIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

// Sample staff data
const staffMembers = [
  {
    id: "1",
    name: "Eddie Lake",
    role: "HVAC Technician",
    avatar: "/avatars/shadcn.jpg",
    workload: "Medium",
  },
  {
    id: "2",
    name: "Jamik Tashpulatov",
    role: "Maintenance Specialist",
    avatar: "/avatars/shadcn.jpg",
    workload: "Low",
  },
  {
    id: "3",
    name: "Thomas Wilson",
    role: "Plumbing Technician",
    avatar: "/avatars/shadcn.jpg",
    workload: "High",
  },
  {
    id: "4",
    name: "Lisa Wong",
    role: "Facilities Manager",
    avatar: "/avatars/shadcn.jpg",
    workload: "Medium",
  },
  {
    id: "5",
    name: "Raj Patel",
    role: "IT Support",
    avatar: "/avatars/shadcn.jpg",
    workload: "Low",
  },
]

interface TransferModalProps {
  ticketId: string
  currentAssignee?: string
  onTransfer: (data: {
    ticketId: string
    assigneeId: string
    reason: string
    remarks: string
  }) => void
}

export function TransferModal({ ticketId, currentAssignee, onTransfer }: TransferModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState("")
  const [reason, setReason] = useState("")
  const [remarks, setRemarks] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaff) return

    onTransfer({
      ticketId,
      assigneeId: selectedStaff,
      reason,
      remarks,
    })

    // Reset form and close modal
    setSelectedStaff("")
    setReason("")
    setRemarks("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserRoundPlusIcon className="h-4 w-4" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Transfer Ticket #{ticketId}</DialogTitle>
          <DialogDescription>
            Transfer this ticket to another staff member. The current assignee will be notified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="staff">Select Staff Member</Label>
              <RadioGroup value={selectedStaff} onValueChange={setSelectedStaff} className="grid gap-2" id="staff">
                {staffMembers
                  .filter((staff) => staff.name !== currentAssignee)
                  .map((staff) => (
                    <div
                      key={staff.id}
                      className={`flex items-center space-x-2 rounded-md border p-3 ${
                        selectedStaff === staff.id ? "border-primary" : ""
                      }`}
                    >
                      <RadioGroupItem value={staff.id} id={`staff-${staff.id}`} className="sr-only" />
                      <Label htmlFor={`staff-${staff.id}`} className="flex flex-1 cursor-pointer items-center gap-3">
                        <Avatar>
                          <AvatarImage src={staff.avatar} alt={staff.name} />
                          <AvatarFallback>{staff.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{staff.name}</div>
                          <div className="text-sm text-muted-foreground">{staff.role}</div>
                        </div>
                        <div
                          className={`rounded-full px-2 py-1 text-xs ${
                            staff.workload === "Low"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                              : staff.workload === "Medium"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {staff.workload} Workload
                        </div>
                      </Label>
                    </div>
                  ))}
              </RadioGroup>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Transfer Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you transferring this ticket?"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remarks">Additional Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information for the new assignee"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedStaff || !reason}>
              Transfer Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
