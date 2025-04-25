import { useEffect, useRef, useState } from "react"
import { ChevronDownIcon, FileIcon, ImageIcon, LockIcon, PaperclipIcon, ChevronRightIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TicketInfoBox } from "@/components/ticket-info-box"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  sender: {
    name: string
    avatar: string
    role: "user" | "staff"
  }
  content: string
  timestamp: string
  attachments: string[]
  isInternal: boolean
}

interface StaffMessageListProps {
  messages: Message[]
  isLoading: boolean
  isTyping: boolean
  ticketStatus: string
  formatDate: (dateString: string) => string
  ticket: any
  role: string
}

export function StaffMessageList({
  messages,
  isLoading,
  isTyping,
  ticketStatus,
  formatDate,
  ticket,
  role,
}: StaffMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Check if user is at the bottom of the messages
  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    // Consider "at bottom" if within 100px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsAtBottom(isAtBottom)
  }

  // Add scroll event listener to check if user is at bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      checkIfAtBottom()
    }

    container.addEventListener("scroll", handleScroll)
    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Scroll to bottom of messages when new messages are added, but only if already at bottom
  useEffect(() => {
    if (!isLoading && isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading, isAtBottom])

  // Scroll to bottom button handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { date: string; messages: typeof messages }[] = []
    let currentDate = ""
    let currentGroup: typeof messages = []

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toDateString()
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup })
        }
        currentDate = messageDate
        currentGroup = [message]
      } else {
        currentGroup.push(message)
      }
    })

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup })
    }

    return groups
  }

  const messageGroups = groupMessagesByDate()

  return (
    <div ref={messagesContainerRef} className="flex-1 overflow-auto p-4 lg:p-6 relative">
      {isLoading ? (
        <div className="absolute top-4 right-4 z-10 bg-background/80 rounded-md p-2 shadow-md">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="text-xs text-muted-foreground">加载中...</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="px-4 py-3 lg:px-6 relative">
          <TicketInfoBox ticket={ticket} role={role} />
        </div>
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            <div className="relative flex items-center py-2">
              <div className="grow border-t"></div>
              <span className="mx-4 shrink text-xs font-medium text-muted-foreground">
                {new Date(group.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <div className="grow border-t"></div>
            </div>

            {group.messages.map((message) => (
              <div
                key={message.id}
                className={`flex animate-fadeIn ${message.sender.role === "staff" ? "justify-end" : "justify-start"}`}
                style={{
                  animationDelay: `${Number.parseInt(message.id) * 0.1}s`,
                  animationDuration: "0.3s",
                }}
              >
                <div
                  className={`flex max-w-[85%] gap-3 ${message.sender.role === "staff" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={message.sender.avatar || "/placeholder.svg"} alt={message.sender.name} />
                    <AvatarFallback>{message.sender.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg p-3 shadow-sm transition-colors ${
                      message.isInternal
                        ? "bg-amber-500/10 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : message.sender.role === "staff"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{message.sender.name}</span>
                        {message.isInternal && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 border-amber-500/50 px-1 py-0 text-[10px]"
                          >
                            <LockIcon className="h-2.5 w-2.5" />
                            Internal Only
                          </Badge>
                        )}
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">{formatDate(message.timestamp)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 rounded bg-background/10 px-2 py-1 text-xs"
                          >
                            {attachment.endsWith(".pdf") ? (
                              <FileIcon className="h-3 w-3" />
                            ) : attachment.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                              <ImageIcon className="h-3 w-3" />
                            ) : (
                              <PaperclipIcon className="h-3 w-3" />
                            )}
                            <span>{attachment}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {ticketStatus === "In Progress" && isTyping && (
          <div className="flex justify-end">
            <div className="flex max-w-[85%] gap-3 flex-row-reverse">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src="/avatars/shadcn.jpg" alt="Support Agent" />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-primary/20 p-3 shadow-xs">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button - only visible when not at bottom */}
      {!isAtBottom && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={scrollToBottom}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-all hover:bg-primary"
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
