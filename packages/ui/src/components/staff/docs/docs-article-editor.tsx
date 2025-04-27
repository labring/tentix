import { useState } from "react"
import { Card, CardContent } from "../ui/card.tsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.tsx"
import { Input } from "../ui/input.tsx"
import { Label } from "../ui/label.tsx"
import { Textarea } from "../ui/textarea.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.tsx"
import { Button } from "../ui/button.tsx"
import { Bold, Italic, Link, List, ListOrdered, ImageIcon, Code } from "lucide-react"

export function DocsArticleEditor({ article }) {
  const [content, setContent] = useState(article.content || "")
  const [title, setTitle] = useState(article.title || "")
  const [category, setCategory] = useState(article.category || "general")
  const [previewMode, setPreviewMode] = useState(false)

  // Mock function to handle markdown formatting
  const handleFormat = (type) => {
    const formats = {
      bold: { prefix: "**", suffix: "**" },
      italic: { prefix: "_", suffix: "_" },
      link: { prefix: "[链接文本](", suffix: ")" },
      list: { prefix: "- ", suffix: "\n- " },
      orderedList: { prefix: "1. ", suffix: "\n2. " },
      image: { prefix: "![图片描述](", suffix: ")" },
      code: { prefix: "```\n", suffix: "\n```" },
    }

    const format = formats[type]
    if (!format) return

    setContent((prev) => prev + format.prefix + format.suffix)
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">文档标题</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入文档标题" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">文档分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="network">网络问题</SelectItem>
                <SelectItem value="system">系统错误</SelectItem>
                <SelectItem value="account">账户问题</SelectItem>
                <SelectItem value="application">应用程序</SelectItem>
                <SelectItem value="general">一般问题</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="write" className="w-full">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="write" onClick={() => setPreviewMode(false)}>
                编辑
              </TabsTrigger>
              <TabsTrigger value="preview" onClick={() => setPreviewMode(true)}>
                预览
              </TabsTrigger>
            </TabsList>

            {!previewMode && (
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => handleFormat("bold")}>
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleFormat("italic")}>
                  <Italic className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleFormat("link")}>
                  <Link className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleFormat("list")}>
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleFormat("orderedList")}>
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleFormat("image")}>
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleFormat("code")}>
                  <Code className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="write" className="mt-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="使用Markdown格式编写文档内容..."
              className="min-h-[400px] font-mono"
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="min-h-[400px] rounded-md border p-4">
              {content ? (
                <div className="prose max-w-none dark:prose-invert">
                  {/* This would be replaced with a proper markdown renderer in a real app */}
                  <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, "<br/>") }} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>预览将在这里显示</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline">取消</Button>
          <Button>保存文档</Button>
        </div>
      </CardContent>
    </Card>
  )
}
