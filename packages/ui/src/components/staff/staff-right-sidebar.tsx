import { Avatar, AvatarFallback, AvatarImage } from "tentix-ui/comp/ui/avatar";
import { Badge } from "tentix-ui/comp/ui/badge";
import { Button } from "tentix-ui/comp/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "tentix-ui/comp/ui/card";
import { Label } from "tentix-ui/comp/ui/label";
import { ScrollArea } from "tentix-ui/comp/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "tentix-ui/comp/ui/tabs";

import {
  ArrowUpCircleIcon,
  CalendarIcon,
  ClockIcon,
  FileIcon,
  HistoryIcon,
  InfoIcon,
  LinkIcon,
  PaperclipIcon,
  TagIcon,
  UserIcon
} from "lucide-react";
import { useState } from "react";
import { useLeftResizablePanel } from "tentix-ui/hooks/resizable-panel.tsx";
import { TicketType } from "tentix-ui/lib/types";
import { format } from "date-fns";
import { StatusBadge } from "../basic/index.tsx";
import { TicketHistory } from "../tickets/ticket-details-sidebar.tsx";

export function StaffRightSidebar({ ticket }: { ticket: TicketType }) {
  const { LeftResizablePanel, isCollapsed, toggleCollapse } =
    useLeftResizablePanel({
      defaultWidth: 250,
      minWidth: 250,
      maxWidth: 500,
    });

  const [activeTab, setActiveTab] = useState<string>("user");

  const customer = ticket.customer;
  const assignedTo = ticket.agent;


  return (
    <div className="hidden border-l md:block max-h-full">
      <LeftResizablePanel>
        <Tabs
          defaultValue="user"
          className="h-full"
          onValueChange={setActiveTab}
        >
          {/* <div className="border-b px-4 py-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="user">User</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>
          </div> */}

          <ScrollArea className="w-full p-4">
            <TabsContent value="user" className="mt-0 space-y-4 h-full w-full">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    User Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={customer.avatar}
                        alt={customer.name}
                      />
                      <AvatarFallback>
                        {customer.name.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.role}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">User ID</Label>
                      <p className="text-sm">{customer.identity}</p>
                    </div>
                    <div>
                      <Label className="text-xs">Nickname</Label>
                      <p className="text-sm">{customer.nickname}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Module</Label>
                    <p className="text-sm">{ticket.module}</p>
                  </div>

                  <div>
                    <Label className="text-xs">Area</Label>
                    <p className="text-sm">{ticket.area}</p>
                  </div>

                  

                  {/* <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    View User Profile
                  </Button> */}
                </CardContent>
              </Card>

              
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Ticket Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <p className="text-sm font-medium">{ticket.title}</p>
                  </div>

                  <div>
                    <Label className="text-xs">Category</Label>
                    <p className="text-sm">{ticket.category}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Ticket ID</Label>
                      <p className="text-sm">#{ticket.id}</p>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <StatusBadge status={ticket.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Created</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {ticket.createdAt && format(new Date(ticket.createdAt), "MMM dd, yyyy")}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Time</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {ticket.createdAt && format(new Date(ticket.createdAt), "HH:mm")}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Occurrence Time</Label>
                    <div className="flex items-center gap-1 text-sm">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {ticket.occurrenceTime && format(new Date(ticket.occurrenceTime), "MMM dd, yyyy HH:mm")}
                    </div>
                  </div>

                  {ticket.errorMessage && (
                    <div>
                      <Label className="text-xs">Error Message</Label>
                      <p className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
                        {ticket.errorMessage}
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <Label className="text-xs">Assigned To</Label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback>
                            {assignedTo.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium">
                          {assignedTo.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Priority</Label>
                    <div className="flex items-center justify-between">
                      <Badge
                        className={
                          ticket.priority === "urgent"
                            ? "bg-red-500"
                            : ticket.priority === "high"
                              ? "bg-orange-500"
                              : ticket.priority === "medium"
                                ? "bg-amber-500"
                                : "bg-green-500"
                        }
                      >
                        {ticket.priority}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Activity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="space-y-3">
                  {ticket.ticketHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((history) => (
                    <TicketHistory key={history.id} history={history} />
                  ))}
                </div>
              </CardContent>
            </Card>

              
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </LeftResizablePanel>
    </div>
  );
}
