import { Ellipsis, Loader2Icon, Undo2 } from "lucide-react";
import { type TicketType } from "tentix-server/rpc";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  timeAgo,
  timeFmt,
} from "tentix-ui";
import useLocalUser from "../../hooks/use-local-user.tsx";
import { useChatStore, useSessionMembersStore } from "../../store/index.ts";
import ContentRenderer from "./content-renderer.tsx";

interface MessageItemProps {
  message: TicketType["messages"][number];
}

const ReadStatusItem = ({
  member,
  status,
}: {
  member: {
    id: number;
    nickname: string;
    avatar: string;
  },
  status: TicketType["messages"][number]["readStatus"][number] | null;
}) => {
  return (
    <div className="flex  items-center gap-2 hover:bg-muted p-2 rounded-md w-full">
      <Avatar className="h-4 w-4 shrink-0">
        <AvatarImage src={member?.avatar} alt={member?.nickname ?? "Unknown"} />
        <AvatarFallback>{member?.nickname?.charAt(0) ?? "U"}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{member?.nickname ?? "Unknown"}</span>
      {status && (
        <span className="text-sm text-muted-foreground ml-auto">
          {timeFmt(status.readAt)}
        </span>
      )}
    </div>
  );
};

export function MessageItem({message }: MessageItemProps) {
  const { id: userId } = useLocalUser();
  const { sessionMembers } = useSessionMembersStore();
  const { isMessageSending, withdrawMessage } = useChatStore();
  if (!sessionMembers) return null;

  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );
  const unreadMembers = sessionMembers
    ?.filter(
      (member) =>
        !message.readStatus.some((status) => status.userId === member.id),
    )
    .filter((member) => member.id !== message.senderId)
    .filter((member) => member.id !== 1);
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
            alt={messageSender?.nickname ?? "Unknown"}
          />
          <AvatarFallback>
            {messageSender?.nickname?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div
          className={`rounded-lg p-3 shadow-sm transition-colors ${
            isMine ? "bg-primary text-primary-foreground" : "bg-muted"
          } ${isMessageSending(message.id) ? "opacity-70" : ""} ${
            message.isInternal ? "border-2 border-dashed bg-yellow-500" : ""
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-medium">
              {messageSender?.nickname ?? "Unknown"}
              {message.isInternal && (
                <span className="ml-2 text-xs text-yellow-500">(Internal)</span>
              )}
            </span>
            <span className="text-xs font-medium flex items-center gap-1">
              {isMessageSending(message.id) && (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              {timeAgo(message.createdAt)}
            </span>
          </div>
          <ContentRenderer doc={message.content} isMine={isMine} />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="smIcon" className="mt-auto">
              <Ellipsis />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60">
            {
              userId === message.senderId && !message.withdrawn && (
                <Button size="sm" className="w-full" onClick={() => withdrawMessage(message.id)}><Undo2 />撤回</Button>
              )
            }
            {
              message.readStatus.length > 0 && (
                <div>
                  <div className="text-sm font-medium">已读</div>
                  <div className="grid gap-1">
                    {message.readStatus.filter((status) => status.userId !== messageSender?.id).map((status) => (
                      <ReadStatusItem key={status.userId} member={sessionMembers.find((member) => member.id === status.userId)!} status={status} />
                    ))}
                  </div>
                </div>
              )
            }
            {
              unreadMembers?.length > 0 && (
                <div>
                  <div className="text-sm font-medium">未读</div>
                  <div className="grid gap-1">
                    {unreadMembers?.map((member) => (
                      <ReadStatusItem key={member.id} member={member} status={null} />
                    ))}
                  </div>
                </div>
              )
            }
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
