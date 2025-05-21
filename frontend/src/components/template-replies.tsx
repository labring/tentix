import { useState } from "react"
import { CheckIcon, ChevronDownIcon, CopyIcon, PlusIcon } from "lucide-react"

import { Button } from "tentix-ui"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "tentix-ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "tentix-ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "tentix-ui"
import { Input } from "tentix-ui"
import { Label } from "tentix-ui"
import { Popover, PopoverContent, PopoverTrigger } from "tentix-ui"
import { Textarea } from "tentix-ui"

// Sample template replies
const defaultTemplates = [
  {
    id: "1",
    title: "Greeting",
    content: "Hello, thank you for contacting support. I'll be assisting you with your ticket today.",
  },
  {
    id: "2",
    title: "Request More Information",
    content:
      "Could you please provide more details about the issue you're experiencing? This will help us resolve your ticket more efficiently.",
  },
  {
    id: "3",
    title: "Closing Ticket",
    content:
      "I believe this resolves your issue. If you have any further questions or if the issue persists, please let us know and we'll be happy to help.",
  },
  {
    id: "4",
    title: "Escalation Notice",
    content:
      "I'll need to escalate this issue to our specialized team. They will contact you shortly with more information.",
  },
  {
    id: "5",
    title: "Follow-up",
    content:
      "I'm following up on your ticket. Have you had a chance to try the solution we suggested? Please let us know if it resolved your issue.",
  },
]

interface TemplateRepliesProps {
  onSelectTemplate: (content: string) => void
}

export function TemplateReplies({ onSelectTemplate }: TemplateRepliesProps) {
  const [templates, setTemplates] = useState(defaultTemplates)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ title: "", content: "" })

  const handleSelectTemplate = (content: string) => {
    onSelectTemplate(content)
    setOpen(false)
  }

  const handleAddTemplate = () => {
    if (newTemplate.title.trim() && newTemplate.content.trim()) {
      setTemplates([
        ...templates,
        {
          id: Date.now().toString(),
          title: newTemplate.title,
          content: newTemplate.content,
        },
      ])
      setNewTemplate({ title: "", content: "" })
      setNewTemplateOpen(false)
    }
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Templates
            <ChevronDownIcon className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Quick Replies</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {templates.slice(0, 3).map((template) => (
              <DropdownMenuItem key={template.id} onClick={() => handleSelectTemplate(template.content)}>
                <span className="truncate">{template.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Browse All Templates
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setNewTemplateOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create New Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="hidden">Open</PopoverTrigger>
        <PopoverContent className="w-[520px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Search templates..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>No templates found.</CommandEmpty>
              <CommandGroup>
                {templates.map((template) => (
                  <CommandItem
                    key={template.id}
                    value={template.title}
                    onSelect={() => handleSelectTemplate(template.content)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{template.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{template.content}</span>
                    </div>
                    <CheckIcon className="ml-auto h-4 w-4 opacity-0 data-selected:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Add a new template reply for quick responses to common inquiries.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="template-title">Template Name</Label>
              <Input
                id="template-title"
                value={newTemplate.title}
                onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                placeholder="E.g., Greeting, Follow-up, etc."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-content">Template Content</Label>
              <Textarea
                id="template-content"
                value={newTemplate.content}
                onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                placeholder="Enter the template message content here..."
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
