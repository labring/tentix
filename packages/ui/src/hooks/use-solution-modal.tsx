import type React from "react"

import { useState } from "react"

import { Button } from "../components/ui/button.js"
import { Checkbox } from "../components/ui/checkbox.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.js"
import { Label } from "../components/ui/label.js"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group.js"
import { Textarea } from "../components/ui/textarea.js"

interface SolutionModalProps {
  ticketId: string
  onSubmit: (data: {
    ticketId: string
    solutionType: string
    description: string
    addToKnowledgeBase: boolean
    sendSurvey: boolean
  }) => void
}

export function useSolutionModal({ ticketId, onSubmit }: SolutionModalProps) {
  const [open, setOpen] = useState(false)
  const [solutionType, setSolutionType] = useState("")
  const [description, setDescription] = useState("")
  const [addToKnowledgeBase, setAddToKnowledgeBase] = useState(false)
  const [sendSurvey, setSendSurvey] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSubmit({
      ticketId,
      solutionType,
      description,
      addToKnowledgeBase,
      sendSurvey,
    })

    // Reset form and close modal
    setSolutionType("")
    setDescription("")
    setAddToKnowledgeBase(false)
    setSendSurvey(true)
    setOpen(false)
  }

  const openModal = () => setOpen(true)
  const closeModal = () => setOpen(false)

  const modal = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Mark Ticket as Solved</DialogTitle>
          <DialogDescription>
            Record the solution for this ticket. This will close the ticket and notify the submitter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Solution Type</Label>
              <RadioGroup value={solutionType} onValueChange={setSolutionType} className="grid gap-2">
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="solved" id="solution-solved" />
                  <Label htmlFor="solution-solved" className="flex-1 cursor-pointer">
                    <div className="font-medium">Solved</div>
                    <div className="text-sm text-muted-foreground">The issue has been fully resolved</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="temporary" id="solution-temporary" />
                  <Label htmlFor="solution-temporary" className="flex-1 cursor-pointer">
                    <div className="font-medium">Temporary Solution</div>
                    <div className="text-sm text-muted-foreground">A workaround has been implemented</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="automatic" id="solution-automatic" />
                  <Label htmlFor="solution-automatic" className="flex-1 cursor-pointer">
                    <div className="font-medium">Automatic Solution</div>
                    <div className="text-sm text-muted-foreground">The issue was resolved automatically</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <RadioGroupItem value="not-reproduced" id="solution-not-reproduced" />
                  <Label htmlFor="solution-not-reproduced" className="flex-1 cursor-pointer">
                    <div className="font-medium">Cannot Be Reproduced</div>
                    <div className="text-sm text-muted-foreground">Unable to reproduce the reported issue</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Solution Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how the issue was resolved"
                className="min-h-[100px]"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="knowledge-base"
                  checked={addToKnowledgeBase}
                  onCheckedChange={(checked) => setAddToKnowledgeBase(checked === true)}
                />
                <Label htmlFor="knowledge-base" className="cursor-pointer">
                  <div className="font-medium">Add to Knowledge Base</div>
                  <div className="text-sm text-muted-foreground">Make this solution available for future reference</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-survey"
                  checked={sendSurvey}
                  onCheckedChange={(checked) => setSendSurvey(checked === true)}
                />
                <Label htmlFor="send-survey" className="cursor-pointer">
                  <div className="font-medium">Send Satisfaction Survey</div>
                  <div className="text-sm text-muted-foreground">Request feedback from the submitter</div>
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={!solutionType || !description}>
              Mark as Solved
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
