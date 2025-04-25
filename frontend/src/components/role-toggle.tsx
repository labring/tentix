"use client"
import { UserIcon, WrenchIcon } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RoleToggleProps {
  role: "user" | "staff"
  onRoleChange: (role: "user" | "staff") => void
}

export function RoleToggle({ role, onRoleChange }: RoleToggleProps) {
  return (
    <div className="px-2 py-1">
      <Tabs value={role} onValueChange={(value) => onRoleChange(value as "user" | "staff")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="user" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>User</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <WrenchIcon className="h-4 w-4" />
            <span>Staff</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
