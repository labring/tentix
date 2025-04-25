import type React from "react"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

interface PriorityModalProps {
  ticketId: string
  currentPriority: string
  onSubmit: (data: {
    ticketId: string
    priority: string
    notifyPersonnel: string[]
    reason: string
  }) => void
}

export function usePriorityModal({ ticketId, currentPriority, onSubmit }: PriorityModalProps) {
  const [open, setOpen] = useState(false)
  const [priority, setPriority] = useState(currentPriority.toLowerCase())
  const [notifyPersonnel, setNotifyPersonnel] = useState<string[]>([])
  const [reason, setReason] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSubmit({
      ticketId,
      priority,
      notifyPersonnel,
      reason,
    })

    // Reset form and close modal
    setPriority(currentPriority.toLowerCase())
    setNotifyPersonnel([])
    setReason("")
    setOpen(false)
  }

  const openModal = () => setOpen(true)
  const closeModal = () => setOpen(false)

  const modal = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Adjust Ticket Priority</DialogTitle>
          <DialogDescription>
            Change the priority level of this ticket. Current priority: <strong>{currentPriority}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Priority Level</Label>
              <RadioGroup value={priority} onValueChange={setPriority} className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                  <RadioGroupItem value="low" id="priority-low" />
                  <Label
                    htmlFor="priority-low"
                    className="flex-1 cursor-pointer font-medium text-green-700 dark:text-green-300"
                  >
                    Low
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                  <RadioGroupItem value="medium" id="priority-medium" />
                  <Label
                    htmlFor="priority-medium"
                    className="flex-1 cursor-pointer font-medium text-amber-700 dark:text-amber-300"
                  >
                    Medium
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                  <RadioGroupItem value="high" id="priority-high" />
                  <Label
                    htmlFor="priority-high"
                    className="flex-1 cursor-pointer font-medium text-orange-700 dark:text-orange-300"
                  >
                    High
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <RadioGroupItem value="critical" id="priority-critical" />
                  <Label
                    htmlFor="priority-critical"
                    className="flex-1 cursor-pointer font-medium text-red-700 dark:text-red-300"
                  >
                    Critical
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label>Notification to Personnel</Label>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-submitter"
                    checked={notifyPersonnel.includes("submitter")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setNotifyPersonnel([...notifyPersonnel, "submitter"])
                      } else {
                        setNotifyPersonnel(notifyPersonnel.filter((p) => p !== "submitter"))
                      }
                    }}
                  />
                  <Label htmlFor="notify-submitter" className="cursor-pointer">
                    Notify Ticket Submitter
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-manager"
                    checked={notifyPersonnel.includes("manager")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setNotifyPersonnel([...notifyPersonnel, "manager"])
                      } else {
                        setNotifyPersonnel(notifyPersonnel.filter((p) => p !== "manager"))
                      }
                    }}
                  />
                  <Label htmlFor="notify-manager" className="cursor-pointer">
                    Notify Department Manager
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-team"
                    checked={notifyPersonnel.includes("team")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setNotifyPersonnel([...notifyPersonnel, "team"])
                      } else {
                        setNotifyPersonnel(notifyPersonnel.filter((p) => p !== "team"))
                      }
                    }}
                  />
                  <Label htmlFor="notify-team" className="cursor-pointer">
                    Notify Support Team
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Adjustment Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're changing the priority"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={!reason || priority === currentPriority.toLowerCase()}>
              Update Priority
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return {
    open,
    openModal,
    closeModal,
    modal,
  }
}
