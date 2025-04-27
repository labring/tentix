import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx"

interface TypingIndicatorProps {
  role: "user" | "staff"
  name: string
  avatar: string
}

export function TypingIndicator({ role, name, avatar }: TypingIndicatorProps) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] gap-3 ${role === "user" ? "flex-row-reverse" : "flex-row"}`}>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={avatar || "/placeholder.svg"} alt={name} />
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div
          className={`rounded-lg p-3 shadow-xs ${role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          <div className="flex space-x-1">
            <div
              className={`h-2 w-2 animate-bounce rounded-full ${
                role === "user" ? "bg-primary-foreground/60" : "bg-muted-foreground/60"
              }`}
            ></div>
            <div
              className={`h-2 w-2 animate-bounce rounded-full ${
                role === "user" ? "bg-primary-foreground/60" : "bg-muted-foreground/60"
              }`}
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className={`h-2 w-2 animate-bounce rounded-full ${
                role === "user" ? "bg-primary-foreground/60" : "bg-muted-foreground/60"
              }`}
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}
