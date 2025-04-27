import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.tsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.tsx"
import { BarChart, BarList } from "@tremor/react"
import { useState } from "react"

export function DocsSearchAnalytics() {
  const [timeRange, setTimeRange] = useState("month")

  // Mock data for search keywords
  const searchKeywords = [
    { keyword: "网络连接失败", count: 342, trend: "+12%" },
    { keyword: "密码重置", count: 271, trend: "+5%" },
    { keyword: "VPN配置", count: 234, trend: "-3%" },
    { keyword: "系统崩溃", count: 198, trend: "+24%" },
    { keyword: "打印机设置", count: 187, trend: "-8%" },
    { keyword: "邮箱同步", count: 156, trend: "+2%" },
    { keyword: "软件安装", count: 143, trend: "+15%" },
    { keyword: "账户锁定", count: 132, trend: "-1%" },
    { keyword: "文件恢复", count: 121, trend: "+7%" },
    { keyword: "蓝屏错误", count: 98, trend: "+31%" },
  ]

  // Mock data for search with no results
  const noResultsSearches = [
    { keyword: "Windows 11升级问题", count: 87, suggested: "操作系统升级" },
    { keyword: "远程桌面连接失败", count: 76, suggested: "远程访问" },
    { keyword: "Office激活错误", count: 65, suggested: "软件激活" },
    { keyword: "无法访问共享文件夹", count: 54, suggested: "文件共享" },
    { keyword: "Teams会议音频问题", count: 43, suggested: "视频会议" },
  ]

  // Mock data for search volume by time
  const searchVolumeData = [
    { hour: "00:00", searches: 42 },
    { hour: "02:00", searches: 28 },
    { hour: "04:00", searches: 15 },
    { hour: "06:00", searches: 34 },
    { hour: "08:00", searches: 178 },
    { hour: "10:00", searches: 256 },
    { hour: "12:00", searches: 134 },
    { hour: "14:00", searches: 243 },
    { hour: "16:00", searches: 176 },
    { hour: "18:00", searches: 98 },
    { hour: "20:00", searches: 76 },
    { hour: "22:00", searches: 54 },
  ]

  // Data for bar list
  const keywordData = searchKeywords.slice(0, 6).map((item) => ({
    name: item.keyword,
    value: item.count,
  }))

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="col-span-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>搜索量分布</CardTitle>
            <CardDescription>按时间的搜索量分布</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">今日</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="year">今年</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <BarChart
            className="h-72"
            data={searchVolumeData}
            index="hour"
            categories={["searches"]}
            colors={["blue"]}
            valueFormatter={(value) => `${value} 次搜索`}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>热门搜索关键词</CardTitle>
          <CardDescription>用户最常搜索的关键词</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>关键词</TableHead>
                <TableHead>搜索次数</TableHead>
                <TableHead>趋势</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchKeywords.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.keyword}</TableCell>
                  <TableCell>{item.count}</TableCell>
                  <TableCell className={item.trend.startsWith("+") ? "text-green-600" : "text-red-600"}>
                    {item.trend}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>热门关键词分布</CardTitle>
          <CardDescription>按搜索量排名的前6个关键词</CardDescription>
        </CardHeader>
        <CardContent>
          <BarList data={keywordData} className="h-60" valueFormatter={(value) => `${value}次`} color="blue" />
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>无结果搜索</CardTitle>
          <CardDescription>用户搜索但未找到结果的关键词</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>搜索关键词</TableHead>
                <TableHead>搜索次数</TableHead>
                <TableHead>建议添加的文档</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {noResultsSearches.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.keyword}</TableCell>
                  <TableCell>{item.count}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">{item.suggested}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
