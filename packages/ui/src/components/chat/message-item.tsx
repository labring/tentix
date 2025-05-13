import { Loader2Icon } from "lucide-react";
import { timeAgo } from "../../lib/utils.ts";
import {
  useSendingMessageStore,
  useSessionMembersStore,
} from "../../store/index.ts";
import useLocalUser from "../../hooks/use-local-user.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx";
import { TicketType } from "tentix-ui/lib/types";
import ContentRenderer from "./content-renderer.tsx";

interface MessageItemProps {
  message: TicketType["messages"][number];
}

export function MessageItem({ message }: MessageItemProps) {
  const { id: userId } = useLocalUser();
  const { sessionMembers } = useSessionMembersStore();
  const { sendingMessage } = useSendingMessageStore();
  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );
  const isMine = message.senderId === userId;
  return (
    <div
      className={`flex animate-fadeIn ${isMine ? "justify-end" : "justify-start"}`}
      // style={{
      //   animationDelay: `${Number.parseInt(message.id) * 0.1}s`,
      //   animationDuration: "0.3s",
      // }}
    >
      <div
        className={`flex max-w-[85%] gap-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage
            src={messageSender?.avatar}
            alt={messageSender?.name ?? "Unknown"}
          />
          <AvatarFallback>
            {messageSender?.name?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div
          className={`rounded-lg p-3 shadow-sm transition-colors ${
            isMine
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          } ${sendingMessage.has(message.id) ? "opacity-70" : ""} ${
            message.isInternal ? "border-2 border-dashed bg-yellow-500" : ""
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-medium">
              {messageSender?.name ?? "Unknown"}
              {message.isInternal && (
                <span className="ml-2 text-xs text-yellow-500">(Internal)</span>
              )}
            </span>
            <span className="text-xs font-medium flex items-center gap-1">
              {sendingMessage.has(message.id) && (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              {timeAgo(message.createdAt)}
            </span>
          </div>
          <ContentRenderer doc={message.content} isMine={isMine} />
        </div>
      </div>
    </div>
  );
}
