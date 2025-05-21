import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "tentix-ui"
import { ArrowDown, ArrowUp, FileText, Search, Users } from "lucide-react"
import { AreaChart, DonutChart } from "@tremor/react"

export function DocsAnalyticsOverview() {
  // Mock data for charts
  const viewsData = [
    { date: "Jan", views: 2890 },
    { date: "Feb", views: 2756 },
    { date: "Mar", views: 3322 },
    { date: "Apr", views: 3470 },
    { date: "May", views: 3475 },
    { date: "Jun", views: 3129 },
    { date: "Jul", views: 3490 },
    { date: "Aug", views: 2903 },
    { date: "Sep", views: 2643 },
    { date: "Oct", views: 4129 },
    { date: "Nov", views: 4380 },
    { date: "Dec", views: 4270 },
  ]

  const categoryData = [
    { name: "网络问题", value: 35 },
    { name: "系统错误", value: 27 },
    { name: "账户问题", value: 15 },
    { name: "应用程序", value: 13 },
    { name: "其他", value: 10 },
  ]

  const deviceData = [
    { name: "桌面设备", value: 65 },
    { name: "移动设备", value: 30 },
    { name: "平板设备", value: 5 },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总阅读量</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45,231</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <ArrowUp className="mr-1 h-3 w-3 text-green-500" />
            <span className="text-green-500">12%</span>
            <span className="ml-1">较上月</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均停留时间</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">4:32</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <ArrowUp className="mr-1 h-3 w-3 text-green-500" />
            <span className="text-green-500">8%</span>
            <span className="ml-1">较上月</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">搜索次数</CardTitle>
          <Search className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12,543</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <ArrowDown className="mr-1 h-3 w-3 text-red-500" />
            <span className="text-red-500">3%</span>
            <span className="ml-1">较上月</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">解决率</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">78%</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <ArrowUp className="mr-1 h-3 w-3 text-green-500" />
            <span className="text-green-500">5%</span>
            <span className="ml-1">较上月</span>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>文档阅读量趋势</CardTitle>
          <CardDescription>过去12个月的文档阅读量</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            className="h-72"
            data={viewsData}
            index="date"
            categories={["views"]}
            colors={["blue"]}
            valueFormatter={(value) => `${value.toLocaleString()} 次阅读`}
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>文档分类阅读分布</CardTitle>
          <CardDescription>按文档分类的阅读量百分比</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart
            className="h-60"
            data={categoryData}
            category="value"
            index="name"
            valueFormatter={(value) => `${value}%`}
            colors={["blue", "cyan", "indigo", "violet", "fuchsia"]}
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>设备访问分布</CardTitle>
          <CardDescription>按设备类型的访问百分比</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart
            className="h-60"
            data={deviceData}
            category="value"
            index="name"
            valueFormatter={(value) => `${value}%`}
            colors={["blue", "cyan", "indigo"]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
