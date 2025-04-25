import { CalendarIcon, ClockIcon, TagIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface TicketInfoBoxProps {
  ticket: {
    id: string
    title: string
    status: string
    priority: string
    category: string
    createdAt: string
    assignedTo?: string
    submittedBy?: {
      name: string
    }
  }
  role: "user" | "staff"
}

export function TicketInfoBox({ ticket, role }: TicketInfoBoxProps) {
  return (
    <Card className="mb-4 overflow-hidden border bg-muted/30">
      <CardContent className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-medium leading-none">{ticket.title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <TagIcon className="h-3 w-3" />
                {ticket.category}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                ticket.status === "Completed"
                  ? "bg-green-500"
                  : ticket.status === "In Progress"
                    ? "bg-amber-500"
                    : "bg-blue-500"
              }
            >
              {ticket.status}
            </Badge>
            <Badge
              variant="outline"
              className={
                ticket.priority === "Critical"
                  ? "border-red-500 text-red-500"
                  : ticket.priority === "High"
                    ? "border-orange-500 text-orange-500"
                    : ticket.priority === "Medium"
                      ? "border-amber-500 text-amber-500"
                      : "border-green-500 text-green-500"
              }
            >
              {ticket.priority} Priority
            </Badge>
            {role === "staff" && ticket.submittedBy && (
              <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                From: {ticket.submittedBy.name}
              </Badge>
            )}
            {role === "user" && ticket.assignedTo && (
              <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                Assigned to: {ticket.assignedTo}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
