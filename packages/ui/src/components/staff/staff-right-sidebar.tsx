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
  FileIcon,
  LinkIcon,
  PaperclipIcon,
  TagIcon,
  UserIcon
} from "lucide-react";
import { useState } from "react";
import { useLeftResizablePanel } from "tentix-ui/hooks/resizable-panel.tsx";
import { TicketType } from "tentix-ui/lib/types";

export function StaffRightSidebar({ ticket }: { ticket: TicketType }) {
  const { LeftResizablePanel, isCollapsed, toggleCollapse } =
    useLeftResizablePanel({
      defaultWidth: 350,
      minWidth: 250,
      maxWidth: 500,
    });

  const [activeTab, setActiveTab] = useState<string>("user");

  const customer = ticket.members.map((member) => member.user).find((user) => user.role === "customer")!;
  const assignedTo = ticket.members.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)).find((member) => member.user.role !== "customer")!.user;

  return (
    <div className="hidden border-l md:block max-h-full">
      <LeftResizablePanel>
        <Tabs
          defaultValue="user"
          className="h-full"
          onValueChange={setActiveTab}
        >
          <div className="border-b px-4 py-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="user">User</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>
          </div>

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
                        src={customer.avatar || "/placeholder.svg"}
                        alt={customer.name}
                      />
                      <AvatarFallback>
                        {customer.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* <div>
                      <Label className="text-xs">Department</Label>
                      <p className="text-sm">{customer.department}</p>
                    </div> */}
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <p className="text-sm">{customer.phoneNum}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Module</Label>
                    <p className="text-sm">{ticket.module}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    View User Profile
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Previous Tickets
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Total Tickets</span>
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Open Tickets</span>
                      <span className="font-medium">3</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg. Resolution Time</span>
                      <span className="font-medium">2.5 days</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-md border p-2 transition-colors hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          #18: Network Outage
                        </span>
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-500 text-[10px]"
                        >
                          Completed
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Closed 2 weeks ago
                      </p>
                    </div>
                    <div className="rounded-md border p-2 transition-colors hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          #14: Printer Issue
                        </span>
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-500 text-[10px]"
                        >
                          In Progress
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated 3 days ago
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="details"
              className="mt-0 space-y-4 h-full w-full"
            >
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Ticket Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-s">
                  {/* <Select
                    defaultValue={ticket.status}
                    onValueChange={handleStatusChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select> */}

                  <div>
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
                      {/* <TransferModal
                                    ticketId={ticket.id}
                                    currentAssignee={ticket.assignedTo}
                                    onTransfer={handleTransfer}
                                  /> */}
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
                      {/* <PriorityModal
                                    ticketId={ticket.id}
                                    currentPriority={ticket.priority}
                                    onSubmit={handlePriorityUpdate}
                                  /> */}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {/* <RequirementsModal ticketId={ticket.id} onSubmit={handleRequirementSubmit} />
                                  <SolutionModal ticketId={ticket.id} onSubmit={handleSolutionSubmit} /> */}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Labels</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="flex flex-wrap gap-2">
                    {ticket.ticketsTags.map((label, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <TagIcon className="h-3 w-3" />
                        {label.tag.name}
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 rounded-full text-xs"
                    >
                      <ArrowUpCircleIcon className="h-3 w-3" />
                      Add Label
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Status History
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-3">
                    {/* {ticket.st.map((history, index) => (
                                  <div key={index} className="flex items-start gap-2">
                                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                                      {history.status === "Completed" ? (
                                        <CheckCircleIcon className="h-3 w-3 text-green-500" />
                                      ) : history.status === "In Progress" ? (
                                        <ClockIcon className="h-3 w-3 text-amber-500" />
                                      ) : (
                                        <AlertTriangleIcon className="h-3 w-3 text-blue-500" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-medium">
                                        {history.status.startsWith("Priority") ? (
                                          history.status
                                        ) : (
                                          <>
                                            Changed to <span className="font-semibold">{history.status}</span>
                                          </>
                                        )}
                                      </p>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <span>{history.user}</span>
                                        <span>•</span>
                                        <span>{timeAgo(history.timestamp)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))} */}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="related"
              className="mt-0 space-y-4 h-full w-full"
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Related Tickets
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-2">
                    {/* {ticket.relatedTickets.map((relatedTicket) => (
                                  <div
                                    key={relatedTicket.id}
                                    className="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                      <span>
                                        #{relatedTicket.id}: {relatedTicket.title}
                                      </span>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={
                                        relatedTicket.status === "Completed"
                                          ? "border-green-500 text-green-500"
                                          : relatedTicket.status === "In Progress"
                                            ? "border-amber-500 text-amber-500"
                                            : "border-blue-500 text-blue-500"
                                      }
                                    >
                                      {relatedTicket.status}
                                    </Badge>
                                  </div>
                                ))} */}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full gap-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Link Related Ticket
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span>AC_Error_Log.pdf</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        View
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span>maintenance-history.pdf</span>
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-500 text-[10px]"
                        >
                          Internal
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        View
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full gap-1"
                  >
                    <PaperclipIcon className="h-3 w-3" />
                    Add Attachment
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </LeftResizablePanel>
    </div>
  );
}
