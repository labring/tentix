import type React from "react"
import { Avatar, AvatarFallback } from "../ui/avatar.tsx"
import { Badge } from "../ui/badge.tsx"
import { Button } from "../ui/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.tsx"
import { ScrollArea } from "../ui/scroll-area.tsx"
import { CheckCircleIcon, ClockIcon, MessageSquareIcon, PhoneIcon } from "lucide-react"
import { TicketType } from "tentix-ui/store";
import { timeAgo } from "tentix-ui/lib/utils"

export function TicketDetailsSidebar({ ticket }: { ticket: TicketType }) {
  const lastAssignee  = ticket.members.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())[0];
  if (lastAssignee)
  return (
    <div className="hidden md:block border-l">
      <ScrollArea className="h-[calc(100vh-48px)]">
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ticket Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Current Status</span>
                <Badge
                  className={
                    ticket.status === "Resolved"
                      ? "bg-green-500"
                      : ticket.status === "In Progress"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }
                >
                  {ticket.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Priority</span>
                <Badge
                  variant="outline"
                  className={
                    ticket.priority === "urgent"
                      ? "border-red-500 text-red-500"
                      : ticket.priority === "high"
                        ? "border-orange-500 text-orange-500"
                        : ticket.priority === "medium"
                          ? "border-amber-500 text-amber-500"
                          : "border-green-500 text-green-500"
                  }
                >
                  {ticket.priority}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Assigned To</span>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback>{lastAssignee.user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{lastAssignee.user.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">Location</span>
                  <p>{ticket.area}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Category</span>
                  <p>{ticket.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* <div>
                  <span className="text-xs text-muted-foreground">Subcategory</span>
                  <p>{ticket.ticketDetails.subcategory}</p>
                </div> */}
                <div>
                  <span className="text-xs text-muted-foreground">Reported On</span>
                  <p>{timeAgo(ticket.createdAt)}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Last Updated</span>
                <p>{timeAgo(ticket.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Activity</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                    <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">New message from Support</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Eddie Lake</span>
                      <span>•</span>
                      <span>{timeAgo(ticket.ticketHistory[0].createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                    <CheckCircleIcon className="h-3 w-3 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Technician assigned</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>System</span>
                      <span>•</span>
                      <span>{timeAgo(ticket.ticketHistory[1].createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                    <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Ticket created</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>You</span>
                      <span>•</span>
                      <span>{timeAgo(ticket.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground mb-3">
                If you need immediate assistance or have questions about this ticket:
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <MessageSquareIcon className="h-4 w-4" />
                  Live Chat with Support
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                  <PhoneIcon className="h-4 w-4" />
                  Call Support: (555) 123-4567
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
