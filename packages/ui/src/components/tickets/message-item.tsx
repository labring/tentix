import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.tsx"
import { FileIcon, ImageIcon, Loader2Icon, PaperclipIcon } from "lucide-react"

interface MessageItemProps {
  message: {
    id: string
    sender: {
      name: string
      avatar: string
      role: "user" | "staff"
    }
    content: string
    timestamp: string
    attachments: string[]
    isLoading: boolean
  }
  formatDate: (dateString: string) => string
}

export function MessageItem({ message, formatDate }: MessageItemProps) {
  return (
    <div
      className={`flex animate-fadeIn ${message.sender.role === "user" ? "justify-end" : "justify-start"}`}
      style={{
        animationDelay: `${Number.parseInt(message.id) * 0.1}s`,
        animationDuration: "0.3s",
      }}
    >
      <div className={`flex max-w-[85%] gap-3 ${message.sender.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={message.sender.avatar || "/placeholder.svg"} alt={message.sender.name} />
          <AvatarFallback>{message.sender.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div
          className={`rounded-lg p-3 shadow-sm transition-colors ${
            message.sender.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
          } ${message.isLoading ? "opacity-70" : ""}`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{message.sender.name}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs opacity-70 flex items-center">
                    {message.isLoading ? <Loader2Icon className="h-3 w-3 animate-spin mr-1" /> : null}
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
                <div key={index} className="flex items-center gap-1 rounded bg-background/10 px-2 py-1 text-xs">
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
  )
}
