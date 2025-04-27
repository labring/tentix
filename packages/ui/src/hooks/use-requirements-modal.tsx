import type React from "react"

import { useState } from "react"

import { Button } from "../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.tsx"
import { Input } from "../components/ui/input.tsx"
import { Label } from "../components/ui/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx"
import { Textarea } from "../components/ui/textarea.tsx"

// Sample product data
const products = [
  { id: "1", name: "HVAC System" },
  { id: "2", name: "Plumbing System" },
  { id: "3", name: "Electrical System" },
  { id: "4", name: "Security System" },
  { id: "5", name: "IT Infrastructure" },
]

interface RequirementsModalProps {
  ticketId: string
  onSubmit: (data: {
    ticketId: string
    title: string
    description: string
    productId: string
    priority: string
  }) => void
}

export function useRequirementsModal({ ticketId, onSubmit }: RequirementsModalProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [productId, setProductId] = useState("")
  const [priority, setPriority] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSubmit({
      ticketId,
      title,
      description,
      productId,
      priority,
    })

    // Reset form and close modal
    setTitle("")
    setDescription("")
    setProductId("")
    setPriority("")
    setOpen(false)
  }

  const openModal = () => setOpen(true)
  const closeModal = () => setOpen(false)

  const modal = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Raise Product Requirements</DialogTitle>
          <DialogDescription>
            Record product requirements related to this ticket. This will be forwarded to the product team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Requirement Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear title for this requirement"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Requirement Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the requirement in detail"
                className="min-h-[100px]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="product">Corresponding Product</Label>
                <Select value={productId} onValueChange={setProductId} required>
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority} required>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title || !description || !productId || !priority}>
              Submit Requirement
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
