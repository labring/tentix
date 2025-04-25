import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Sample data for work orders over time
const chartData = [
  { date: "2024-01-01", submitted: 3, completed: 1 },
  { date: "2024-02-01", submitted: 5, completed: 4 },
  { date: "2024-03-01", submitted: 2, completed: 3 },
  { date: "2024-04-01", submitted: 4, completed: 2 },
  { date: "2024-05-01", submitted: 6, completed: 5 },
  { date: "2024-06-01", submitted: 3, completed: 4 },
]

const chartConfig = {
  submitted: {
    label: "Submitted",
    color: "hsl(var(--chart-1))",
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function UserChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("6m")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("3m")
    }
  }, [isMobile])

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>My Request History</CardTitle>

        <CardDescription>
          <span className="@[540px]/card:block hidden">Your submitted and completed requests</span>
          <span className="@[540px]/card:hidden">Last 6 months</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="6m" className="h-8 px-2.5">
              Last 6 months
            </ToggleGroupItem>
            <ToggleGroupItem value="3m" className="h-8 px-2.5">
              Last 3 months
            </ToggleGroupItem>
            <ToggleGroupItem value="1m" className="h-8 px-2.5">
              Last month
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="@[767px]/card:hidden flex w-40" aria-label="Select a value">
              <SelectValue placeholder="Last 6 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="6m" className="rounded-lg">
                Last 6 months
              </SelectItem>
              <SelectItem value="3m" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="1m" className="rounded-lg">
                Last month
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillSubmitted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-submitted)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-submitted)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area dataKey="completed" type="monotone" fill="url(#fillCompleted)" stroke="var(--color-completed)" />
            <Area dataKey="submitted" type="monotone" fill="url(#fillSubmitted)" stroke="var(--color-submitted)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
