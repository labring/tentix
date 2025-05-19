import { useState } from "react"
import { Input } from "tentix-ui"
import { Card, CardContent } from "tentix-ui"
import { Avatar, AvatarFallback, AvatarImage } from "tentix-ui"
import { Badge } from "tentix-ui"
import { Search } from "lucide-react"

export function StaffList({ staffData, onStaffSelect }) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStaff = staffData.filter(
    (staff) =>
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.position.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search staff by name, department, or position..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStaff.map((staff) => (
          <Card
            key={staff.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => onStaffSelect(staff)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={staff.avatar} alt={staff.name} />
                  <AvatarFallback>
                    {staff.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <h3 className="font-semibold">{staff.name}</h3>
                  <p className="text-sm text-muted-foreground">{staff.position}</p>
                  <div className="mt-2">
                    <Badge variant="outline" className="mr-1">
                      {staff.department}
                    </Badge>
                    {staff.status === "Active" ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Away</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
          <p className="text-muted-foreground">No staff members found</p>
        </div>
      )}
    </div>
  )
}
