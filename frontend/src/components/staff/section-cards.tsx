import { CheckCircle2Icon, ClockIcon, Loader2Icon, AlertTriangleIcon } from "lucide-react"

import { Badge } from "tentix-ui"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "tentix-ui"

export function StaffSectionCards() {
  return (
    <div className="data-[slot=card]:*:shadow-2xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 data-[slot=card]:*:bg-linear-to-t data-[slot=card]:*:from-primary/5 data-[slot=card]:*:to-card dark:data-[slot=card]:*:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Total Open Orders</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">12</CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg bg-blue-500/10 text-xs text-blue-500">
              <ClockIcon className="size-3" />
              Pending
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">5 unassigned orders</div>
          <div className="text-muted-foreground">7 in progress</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Assigned to Team</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">8</CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg bg-amber-500/10 text-xs text-amber-500">
              <Loader2Icon className="size-3" />
              In Progress
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">3 due today</div>
          <div className="text-muted-foreground">5 assigned to Eddie</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Completed Today</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">5</CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg bg-green-500/10 text-xs text-green-500">
              <CheckCircle2Icon className="size-3" />
              Completed
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">15 completed this week</div>
          <div className="text-muted-foreground">Ahead of schedule</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>Critical Issues</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">3</CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg bg-red-500/10 text-xs text-red-500">
              <AlertTriangleIcon className="size-3" />
              Critical
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">All assigned to staff</div>
          <div className="text-muted-foreground">1 requires vendor support</div>
        </CardFooter>
      </Card>
    </div>
  )
}
