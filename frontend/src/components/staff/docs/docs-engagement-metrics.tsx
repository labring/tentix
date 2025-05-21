import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "tentix-ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "tentix-ui"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "tentix-ui"
import { AreaChart, BarChart, DonutChart } from "@tremor/react"
import { useState } from "react"

export function DocsEngagementMetrics() {
  const [timeRange, setTimeRange] = useState("month")

  // Mock data for engagement metrics
  const engagementTrend = [
    { date: "Jan", avgTime: 3.2, completionRate: 72, feedbackScore: 4.1 },
    { date: "Feb", avgTime: 3.5, completionRate: 74, feedbackScore: 4.2 },
    { date: "Mar", avgTime: 3.8, completionRate: 75, feedbackScore: 4.3 },
    { date: "Apr", avgTime: 4.1, completionRate: 76, feedbackScore: 4.2 },
    { date: "May", avgTime: 4.3, completionRate: 78, feedbackScore: 4.4 },
    { date: "Jun", avgTime: 4.5, completionRate: 79, feedbackScore: 4.5 },
    { date: "Jul", avgTime: 4.2, completionRate: 77, feedbackScore: 4.3 },
    { date: "Aug", avgTime: 4.0, completionRate: 76, feedbackScore: 4.2 },
    { date: "Sep", avgTime: 4.3, completionRate: 78, feedbackScore: 4.4 },
    { date: "Oct", avgTime: 4.6, completionRate: 80, feedbackScore: 4.6 },
    { date: "Nov", avgTime: 4.8, completionRate: 82, feedbackScore: 4.7 },
    { date: "Dec", avgTime: 4.7, completionRate: 81, feedbackScore: 4.6 },
  ]

  // Mock data for user segments
  const userSegments = [
    { segment: "新用户", percentage: 35 },
    { segment: "回访用户", percentage: 45 },
    { segment: "高频用户", percentage: 20 },
  ]

  // Mock data for feedback distribution
  const feedbackDistribution = [
    { rating: "5星", percentage: 42 },
    { rating: "4星", percentage: 38 },
    { rating: "3星", percentage: 12 },
    { rating: "2星", percentage: 5 },
    { rating: "1星", percentage: 3 },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="col-span-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>用户参与度趋势</CardTitle>
            <CardDescription>文档阅读时间和完成率趋势</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">月度</SelectItem>
              <SelectItem value="quarter">季度</SelectItem>
              <SelectItem value="year">年度</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="time">
            <TabsList className="mb-4">
              <TabsTrigger value="time">平均阅读时间</TabsTrigger>
              <TabsTrigger value="completion">文档完成率</TabsTrigger>
              <TabsTrigger value="feedback">反馈评分</TabsTrigger>
            </TabsList>
            <TabsContent value="time">
              <AreaChart
                className="h-72"
                data={engagementTrend}
                index="date"
                categories={["avgTime"]}
                colors={["blue"]}
                valueFormatter={(value) => `${value} 分钟`}
              />
            </TabsContent>
            <TabsContent value="completion">
              <AreaChart
                className="h-72"
                data={engagementTrend}
                index="date"
                categories={["completionRate"]}
                colors={["green"]}
                valueFormatter={(value) => `${value}%`}
              />
            </TabsContent>
            <TabsContent value="feedback">
              <AreaChart
                className="h-72"
                data={engagementTrend}
                index="date"
                categories={["feedbackScore"]}
                colors={["amber"]}
                valueFormatter={(value) => `${value}/5`}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用户细分</CardTitle>
          <CardDescription>按用户类型的文档访问分布</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart
            className="h-60"
            data={userSegments}
            category="percentage"
            index="segment"
            valueFormatter={(value) => `${value}%`}
            colors={["blue", "cyan", "indigo"]}
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>用户反馈分布</CardTitle>
          <CardDescription>文档用户满意度评分分布</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            className="h-60"
            data={feedbackDistribution}
            index="rating"
            categories={["percentage"]}
            colors={["amber"]}
            valueFormatter={(value) => `${value}%`}
          />
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>用户行为洞察</CardTitle>
          <CardDescription>基于用户交互数据的关键洞察</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <h3 className="text-lg font-semibold">文档跳出率</h3>
              <p className="text-sm text-muted-foreground">用户在阅读不到30秒就离开的比例</p>
              <div className="mt-4 text-2xl font-bold">24%</div>
              <p className="text-xs text-green-600">较上月下降2%</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-lg font-semibold">问题解决率</h3>
              <p className="text-sm text-muted-foreground">用户表示问题已解决的比例</p>
              <div className="mt-4 text-2xl font-bold">78%</div>
              <p className="text-xs text-green-600">较上月上升5%</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="text-lg font-semibold">文档分享率</h3>
              <p className="text-sm text-muted-foreground">被用户分享给他人的文档比例</p>
              <div className="mt-4 text-2xl font-bold">12%</div>
              <p className="text-xs text-green-600">较上月上升3%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
