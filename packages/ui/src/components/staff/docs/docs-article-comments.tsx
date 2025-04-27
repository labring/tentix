import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.tsx"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx"
import { Button } from "../ui/button.tsx"
import { Textarea } from "../ui/textarea.tsx"
import { ThumbsUp, ThumbsDown, MessageSquare, Flag } from "lucide-react"

export function DocsArticleComments({ articleId }) {
  const [replyTo, setReplyTo] = useState(null)
  const [replyContent, setReplyContent] = useState("")

  // Mock data for user comments
  const comments = [
    {
      id: 1,
      user: {
        name: "张明",
        avatar: "/vibrant-street-market.png",
        role: "用户",
      },
      content: "这篇文档非常有帮助，我按照步骤解决了网络连接问题。谢谢！",
      date: "2023-11-28T09:23:45",
      helpful: 12,
      unhelpful: 1,
      replies: [],
    },
    {
      id: 2,
      user: {
        name: "李华",
        avatar: "/vibrant-street-market.png",
        role: "用户",
      },
      content: "第三步的说明有点不清楚，我在Windows 11上找不到那个设置选项。能否更新一下？",
      date: "2023-11-27T14:12:33",
      helpful: 8,
      unhelpful: 2,
      replies: [
        {
          id: 21,
          user: {
            name: "王技术",
            avatar: "/diverse-office-team.png",
            role: "技术支持",
          },
          content: "感谢您的反馈！Windows 11的设置路径略有不同，我们已经更新了文档，请刷新页面查看最新内容。",
          date: "2023-11-27T15:45:22",
        },
      ],
    },
    {
      id: 3,
      user: {
        name: "刘芳",
        avatar: "/vibrant-street-market.png",
        role: "用户",
      },
      content: "这个解决方案对我的情况不适用，我的问题是在VPN连接后无法访问内部资源，而不是连接本身的问题。",
      date: "2023-11-26T10:05:17",
      helpful: 3,
      unhelpful: 5,
      replies: [],
    },
  ]

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
  }

  const handleReply = (commentId) => {
    setReplyTo(commentId)
    setReplyContent("")
  }

  const submitReply = () => {
    // In a real app, this would send the reply to the server
    console.log(`Replying to comment ${replyTo}: ${replyContent}`)
    setReplyTo(null)
    setReplyContent("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户反馈</CardTitle>
        <CardDescription>用户对此文档的评论和问题</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <Avatar>
                      <AvatarImage src={comment.user.avatar || "/placeholder.svg"} alt={comment.user.name} />
                      <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{comment.user.name}</h4>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          {comment.user.role}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(comment.date)}</p>
                      <div className="mt-2">{comment.content}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{comment.helpful}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{comment.unhelpful}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => handleReply(comment.id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>回复</span>
                  </Button>
                </div>

                {replyTo === comment.id && (
                  <div className="mt-4 space-y-2">
                    <Textarea
                      placeholder="输入您的回复..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setReplyTo(null)}>
                        取消
                      </Button>
                      <Button size="sm" onClick={submitReply}>
                        提交回复
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {comment.replies.length > 0 && (
                <div className="ml-12 space-y-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="rounded-lg border p-4">
                      <div className="flex items-start space-x-4">
                        <Avatar>
                          <AvatarImage src={reply.user.avatar || "/placeholder.svg"} alt={reply.user.name} />
                          <AvatarFallback>{reply.user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{reply.user.name}</h4>
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              {reply.user.role}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{formatDate(reply.date)}</p>
                          <div className="mt-2">{reply.content}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
