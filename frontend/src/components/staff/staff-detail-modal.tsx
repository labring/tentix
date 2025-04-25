import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Phone, MapPin, Briefcase, Package, Calendar, Clock, AlertCircle, CheckCircle, User } from "lucide-react"
import { DataTable } from "@/components/data-table"

export function StaffDetailModal({ staff, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("info")

  if (!staff) return null

  // Format work orders for the data table
  const workOrderColumns = [
    { header: "ID", accessorKey: "id" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge
            className={
              status === "Completed"
                ? "bg-green-100 text-green-800"
                : status === "In Progress"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
            }
          >
            {status}
          </Badge>
        )
      },
    },
    { header: "Initiator", accessorKey: "initiator" },
    { header: "Priority", accessorKey: "priority" },
    { header: "Updated", accessorKey: "updatedAt" },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={staff.avatar} alt={staff.name} />
              <AvatarFallback>
                {staff.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">{staff.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{staff.position}</p>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Personal Info</TabsTrigger>
            <TabsTrigger value="workorders">Work Orders</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Details about {staff.name}'s role and responsibilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Department:</span> {staff.department}
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Position:</span> {staff.position}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Joined:</span> {staff.joinedDate}
                </div>
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <span className="font-medium">Product Responsibilities:</span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {staff.productResponsibilities.map((product, index) => (
                        <Badge key={index} variant="outline">
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Status:</span>
                  <Badge
                    className={
                      staff.status === "Active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {staff.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workorders" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Work Order History</CardTitle>
                <CardDescription>Current and completed work orders</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="current">
                  <TabsList className="mb-4">
                    <TabsTrigger value="current" className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> Current
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Completed
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="current">
                    <DataTable
                      columns={workOrderColumns}
                      data={staff.workOrders.filter((wo) => wo.status !== "Completed")}
                    />
                  </TabsContent>
                  <TabsContent value="completed">
                    <DataTable
                      columns={workOrderColumns}
                      data={staff.workOrders.filter((wo) => wo.status === "Completed")}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Ways to reach {staff.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <a href={`mailto:${staff.email}`} className="text-blue-600 hover:underline">
                    {staff.email}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Phone:</span>
                  <a href={`tel:${staff.phone}`} className="text-blue-600 hover:underline">
                    {staff.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Location:</span> {staff.location}
                </div>
                {staff.availability && (
                  <div>
                    <h4 className="mb-2 font-medium">Availability:</h4>
                    <div className="rounded-md border p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(staff.availability).map(([day, hours]) => (
                          <div key={day} className="flex justify-between">
                            <span className="font-medium">{day}:</span>
                            <span>{hours}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
