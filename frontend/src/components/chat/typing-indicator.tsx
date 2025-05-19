import { useSessionMembersStore } from "../../store/index.ts";
import { Avatar, AvatarFallback, AvatarImage } from "tentix-ui";

interface TypingIndicatorProps {
  id: number;
}

export function TypingIndicator({ id }: TypingIndicatorProps) {
  const member = useSessionMembersStore((state) => state.sessionMembers)?.find(
    (member) => member.id === id,
  );
  if (member) {
    return (
      <div className={`flex justify-start`}>
        <div className={`flex max-w-[85%] gap-3`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={member.avatar} alt={member.name} />
            <AvatarFallback>{member.nickname.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className={`rounded-lg p-3 shadow-xs bg-muted`}>
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
    );
  }
}
