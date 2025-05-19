import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "tentix-ui"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "tentix-ui"
import { Button } from "tentix-ui"
import { Input } from "tentix-ui"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "tentix-ui"
import { BarChart, Search, ArrowUpDown, ExternalLink, Edit } from "lucide-react"
import { mockArticles } from "@/data/docs-data"

export function DocsPopularArticles() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("views")
  const [timeRange, setTimeRange] = useState("all")

  // Filter and sort articles
  const filteredArticles = mockArticles
    .filter(
      (article) =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.category.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "views") return b.views - a.views
      if (sortBy === "title") return a.title.localeCompare(b.title)
      if (sortBy === "date") return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      return 0
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>热门文档</CardTitle>
        <CardDescription>查看最受欢迎的文档和它们的阅读量</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索文档..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">今日</SelectItem>
                  <SelectItem value="week">本周</SelectItem>
                  <SelectItem value="month">本月</SelectItem>
                  <SelectItem value="year">今年</SelectItem>
                  <SelectItem value="all">全部时间</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">阅读量</SelectItem>
                  <SelectItem value="title">标题</SelectItem>
                  <SelectItem value="date">更新日期</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">文档标题</TableHead>
                  <TableHead className="w-[15%]">分类</TableHead>
                  <TableHead className="w-[15%]">
                    <div className="flex items-center">
                      阅读量
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[15%]">最后更新</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium">{article.title}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        {article.category}
                      </span>
                    </TableCell>
                    <TableCell>{article.views.toLocaleString()}</TableCell>
                    <TableCell>{new Date(article.lastUpdated).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/staff/docs-management/${article.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/user/docs/solutions/${article.id}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/staff/docs-management/${article.id}?tab=analytics`)}
                        >
                          <BarChart className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredArticles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      没有找到匹配的文档
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
