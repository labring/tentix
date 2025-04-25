import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AreaChart, BarChart } from "@tremor/react"
import { useState } from "react"

export function DocsArticleAnalytics({ articleId }) {
  const [timeRange, setTimeRange] = useState("month")

  // Mock data for article views over time
  const viewsData = [
    { date: "1", views: 42 },
    { date: "2", views: 38 },
    { date: "3", views: 45 },
    { date: "4", views: 53 },
    { date: "5", views: 49 },
    { date: "6", views: 62 },
    { date: "7", views: 58 },
    { date: "8", views: 71 },
    { date: "9", views: 67 },
    { date: "10", views: 72 },
    { date: "11", views: 84 },
    { date: "12", views: 79 },
    { date: "13", views: 92 },
    { date: "14", views: 87 },
    { date: "15", views: 93 },
    { date: "16", views: 99 },
    { date: "17", views: 94 },
    { date: "18", views: 102 },
    { date: "19", views: 98 },
    { date: "20", views: 105 },
    { date: "21", views: 112 },
    { date: "22", views: 108 },
    { date: "23", views: 115 },
    { date: "24", views: 120 },
    { date: "25", views: 118 },
    { date: "26", views: 125 },
    { date: "27", views: 132 },
    { date: "28", views: 137 },
    { date: "29", views: 142 },
    { date: "30", views: 147 },
  ]

  // Mock data for referral sources
  const referralData = [
    { source: "直接访问", visits: 423 },
    { source: "搜索引擎", visits: 287 },
    { source: "内部链接", visits: 164 },
    { source: "邮件链接", visits: 87 },
    { source: "社交媒体", visits: 42 },
  ]

  // Mock data for user engagement
  const engagementData = {
    avgTimeOnPage: "4:32",
    completionRate: "78%",
    helpfulRating: "92%",
    bounceRate: "24%",
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>文档访问趋势</CardTitle>
            <CardDescription>文档访问量随时间的变化</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="year">今年</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <AreaChart
            className="h-72"
            data={viewsData}
            index="date"
            categories={["views"]}
            colors={["blue"]}
            valueFormatter={(value) => `${value} 次访问`}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">平均停留时间</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementData.avgTimeOnPage}</div>
            <p className="text-xs text-muted-foreground">较平均值高出12%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">完成阅读率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementData.completionRate}</div>
            <p className="text-xs text-muted-foreground">较平均值高出8%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">有帮助评价</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementData.helpfulRating}</div>
            <p className="text-xs text-muted-foreground">较平均值高出15%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">跳出率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementData.bounceRate}</div>
            <p className="text-xs text-muted-foreground">较平均值低5%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>访问来源</CardTitle>
          <CardDescription>用户从哪里访问此文档</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            className="h-60"
            data={referralData}
            index="source"
            categories={["visits"]}
            colors={["blue"]}
            valueFormatter={(value) => `${value} 次访问`}
          />
        </CardContent>
      </Card>
    </div>
  )
}
