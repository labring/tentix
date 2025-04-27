import type React from "react"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "../ui/button.tsx"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card.tsx"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form.tsx"
import { Input } from "../ui/input.tsx"
import { Textarea } from "../ui/textarea.tsx"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.tsx"
import { Checkbox } from "../ui/checkbox.tsx"
import { toast } from "../ui/use-toast.tsx"
import { FileText, Upload, X } from "lucide-react"
import { Badge } from "../ui/badge.tsx"
import { ScrollArea } from "../ui/scroll-area.tsx"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const formSchema = z.object({
  title: z
    .string()
    .min(5, {
      message: "标题至少需要5个字符",
    })
    .max(100, {
      message: "标题不能超过100个字符",
    }),
  category: z.string({
    required_error: "请选择问题类别",
  }),
  relatedIssues: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"], {
    required_error: "请选择紧急程度",
  }),
  description: z
    .string()
    .min(10, {
      message: "问题描述至少需要10个字符",
    })
    .max(2000, {
      message: "问题描述不能超过2000个字符",
    }),
  affectedSystems: z.array(z.string()).min(1, {
    message: "请至少选择一个受影响的系统",
  }),
  notifyTeam: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

const issueCategories = [
  { value: "system-error", label: "系统错误" },
  { value: "performance", label: "性能问题" },
  { value: "security", label: "安全漏洞" },
  { value: "ui-ux", label: "界面/用户体验问题" },
  { value: "data", label: "数据问题" },
  { value: "integration", label: "集成问题" },
  { value: "other", label: "其他" },
]

const existingIssues = [
  { id: "ISSUE-1001", title: "登录页面加载缓慢", category: "performance" },
  { id: "ISSUE-1002", title: "用户数据无法同步", category: "data" },
  { id: "ISSUE-1003", title: "安全证书过期警告", category: "security" },
  { id: "ISSUE-1004", title: "移动端菜单显示异常", category: "ui-ux" },
  { id: "ISSUE-1005", title: "第三方API连接失败", category: "integration" },
  { id: "ISSUE-1006", title: "数据库查询超时", category: "performance" },
  { id: "ISSUE-1007", title: "用户权限错误", category: "security" },
  { id: "ISSUE-1008", title: "报表数据不准确", category: "data" },
]

const affectedSystems = [
  { id: "user-portal", label: "用户门户" },
  { id: "admin-dashboard", label: "管理员仪表板" },
  { id: "reporting", label: "报表系统" },
  { id: "database", label: "数据库" },
  { id: "api", label: "API服务" },
  { id: "authentication", label: "认证系统" },
  { id: "file-storage", label: "文件存储" },
  { id: "notification", label: "通知系统" },
]

export function StaffReportForm() {
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      relatedIssues: [],
      affectedSystems: [],
      notifyTeam: false,
    },
  })

  function onSubmit(data: FormValues) {
    setIsSubmitting(true)

    // 模拟API请求
    setTimeout(() => {
      console.log("Form data:", data)
      console.log("Attached files:", files)

      toast({
        title: "问题报告已提交",
        description: "您的问题报告已成功提交，编号为 ISSUE-" + Math.floor(1000 + Math.random() * 9000),
      })

      // 重置表单
      form.reset()
      setFiles([])
      setIsSubmitting(false)
    }, 1500)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)

      // 检查文件大小
      const oversizedFiles = newFiles.filter((file) => file.size > MAX_FILE_SIZE)
      if (oversizedFiles.length > 0) {
        toast({
          title: "文件过大",
          description: `${oversizedFiles.map((f) => f.name).join(", ")} 超过5MB限制`,
          variant: "destructive",
        })
        return
      }

      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>问题基本信息</CardTitle>
            <CardDescription>请提供问题的基本信息，包括标题、类别和紧急程度</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>问题标题</FormLabel>
                  <FormControl>
                    <Input placeholder="简要描述问题" {...field} />
                  </FormControl>
                  <FormDescription>请用简洁的语言描述问题</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>问题类别</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择问题类别" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {issueCategories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>紧急程度</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="low" />
                          </FormControl>
                          <FormLabel className="font-normal">低 - 不影响正常使用</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="medium" />
                          </FormControl>
                          <FormLabel className="font-normal">中 - 部分功能受影响</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="high" />
                          </FormControl>
                          <FormLabel className="font-normal">高 - 主要功能无法使用</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="critical" />
                          </FormControl>
                          <FormLabel className="font-normal">紧急 - 系统完全无法使用</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>问题详情</CardTitle>
            <CardDescription>提供问题的详细描述和相关信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>问题描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请详细描述问题的表现、复现步骤和影响范围"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>请尽可能详细地描述问题，包括如何复现、影响范围等</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="affectedSystems"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">受影响的系统</FormLabel>
                    <FormDescription>选择受此问题影响的系统或模块</FormDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {affectedSystems.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="affectedSystems"
                        render={({ field }) => {
                          return (
                            <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, item.id])
                                      : field.onChange(field.value?.filter((value) => value !== item.id))
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">{item.label}</FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>关联问题</CardTitle>
            <CardDescription>选择与此问题相关的已知问题</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="relatedIssues"
              render={({ field }) => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">相关问题</FormLabel>
                    <FormDescription>如果此问题与现有问题相关，请选择它们</FormDescription>
                  </div>
                  <ScrollArea className="h-[200px] rounded-md border p-4">
                    <div className="space-y-4">
                      {existingIssues.map((issue) => (
                        <div key={issue.id} className="flex items-start space-x-3">
                          <Checkbox
                            id={issue.id}
                            checked={field.value?.includes(issue.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), issue.id])
                                : field.onChange(field.value?.filter((value) => value !== issue.id))
                            }}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={issue.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {issue.title}
                              <Badge className="ml-2" variant="outline">
                                {issueCategories.find((c) => c.value === issue.category)?.label}
                              </Badge>
                            </label>
                            <p className="text-sm text-muted-foreground">{issue.id}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>附件</CardTitle>
            <CardDescription>上传与问题相关的截图或文件</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="file-upload">上传文件</Label>
                <div className="flex items-center gap-2">
                  <Input id="file-upload" type="file" multiple onChange={handleFileChange} className="w-full" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    浏览
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">支持的文件类型: PNG, JPG, PDF, DOC, XLSX (最大5MB)</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <Label>已上传文件</Label>
                  <div className="rounded-md border">
                    <div className="p-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{file.name}</span>
                            <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>通知设置</CardTitle>
            <CardDescription>设置问题报告的通知选项</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notifyTeam"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>通知团队成员</FormLabel>
                    <FormDescription>向相关团队成员发送此问题报告的通知</FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={() => form.reset()}>
              重置
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "提交中..." : "提交报告"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      {...props}
    />
  )
}
