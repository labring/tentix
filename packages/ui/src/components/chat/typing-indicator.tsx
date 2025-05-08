import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx"

interface TypingIndicatorProps {
  name: string
  avatar: string
}

export function TypingIndicator({ name, avatar }: TypingIndicatorProps) {
  return (
    <div className={`flex justify-start`}>
      <div className={`flex max-w-[85%] gap-3`}>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={avatar || "/placeholder.svg"} alt={name} />
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div
          className={`rounded-lg p-3 shadow-xs bg-muted`}
        >
          <div className="flex space-x-1">
            <div
              className={`h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60`}
            ></div>
            <div
              className={`h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60`}
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className={`h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60`}
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}
