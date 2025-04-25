import { BugIcon, CalendarIcon, FileTextIcon, LightbulbIcon, MapPinIcon, PlusIcon } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { AffectedResourcesSelector } from "@/components/tickets/affected-resources-selector"

interface TicketDetailsSectionProps {
  className?: string
  ticketType: string
  setTicketType: (type: string) => void
  occurrenceDate?: Date
  setOccurrenceDate: (date?: Date) => void
  selectedResources: string[]
  setSelectedResources: (resources: string[]) => void
}

export function TicketDetailsSection({
  className,
  ticketType,
  setTicketType,
  occurrenceDate,
  setSelectedResources,
  selectedResources,
}: TicketDetailsSectionProps) {
  const setOccurrenceDate = (date?: Date) => {
    console.log("Selected date:", date)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Ticket Details</CardTitle>
        <CardDescription>Provide information about your issue or request</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input id="title" placeholder="Brief description of the issue" required />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="module">
              System Module <span className="text-red-500">*</span>
            </Label>
            <Select required>
              <SelectTrigger id="module">
                <SelectValue placeholder="Select module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="reports">Reports</SelectItem>
                <SelectItem value="users">User Management</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurrence-time">Occurrence Time</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !occurrenceDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {occurrenceDate ? format(occurrenceDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={occurrenceDate} onSelect={setOccurrenceDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            Ticket Type <span className="text-red-500">*</span>
          </Label>
          <RadioGroup
            defaultValue="bug"
            className="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4 max-w-96"
            onValueChange={setTicketType}
            value={ticketType}
          >
            <div>
              <RadioGroupItem value="bug" id="bug" className="peer sr-only" />
              <Label
                htmlFor="bug"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <BugIcon className="mb-2 h-4 w-4" />
                Bug
              </Label>
            </div>

            <div>
              <RadioGroupItem value="feature" id="feature" className="peer sr-only" />
              <Label
                htmlFor="feature"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <LightbulbIcon className="mb-2 h-4 w-4" />
                Feature
              </Label>
            </div>

            <div>
              <RadioGroupItem value="question" id="question" className="peer sr-only" />
              <Label
                htmlFor="question"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <FileTextIcon className="mb-2 h-4 w-4" />
                Question
              </Label>
            </div>

            <div>
              <RadioGroupItem value="other" id="other" className="peer sr-only" />
              <Label
                htmlFor="other"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <PlusIcon className="mb-2 h-4 w-4" />
                Other
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Description <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Detailed description of the issue or request"
            className="min-h-32"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="affected-area">Affected Area</Label>
            <Input
              id="affected-area"
              placeholder="e.g., US-East Region, Production Environment"
              icon={<MapPinIcon className="h-4 w-4" />}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">
              Priority <span className="text-red-500">*</span>
            </Label>
            <Select>
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

        <AffectedResourcesSelector selectedResources={selectedResources} setSelectedResources={setSelectedResources} />

        <div className="space-y-2">
          <Label htmlFor="error-message">Error Message</Label>
          <Textarea id="error-message" placeholder="Paste any error messages or logs here" className="min-h-20" />
        </div>
      </CardContent>
    </Card>
  )
}
