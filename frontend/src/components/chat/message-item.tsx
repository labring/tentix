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
} from "tentix-ui";
import useLocalUser from "../../hooks/use-local-user.tsx";
import { useChatStore, useSessionMembersStore } from "../../store/index.ts";
import ContentRenderer from "./content-renderer.tsx";
import { useTranslation } from "i18n";

interface MessageItemProps {
  message: TicketType["messages"][number];
}

// other's message component
const OtherMessage = ({
  message,
}: {
  message: TicketType["messages"][number];
}) => {
  const { sessionMembers } = useSessionMembersStore();
  const { isMessageSending } = useChatStore();

  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );

  return (
    <div className="flex animate-fadeIn justify-start">
      <div className="flex max-w-[85%] gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage
            src={messageSender?.avatar}
            alt={messageSender?.nickname ?? "Unknown"}
          />
          <AvatarFallback>
            {messageSender?.nickname?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          {/* name and time */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {messageSender?.nickname ?? "Unknown"}
              {message.isInternal && (
                <span className="ml-2 text-xs text-yellow-500">(Internal)</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isMessageSending(message.id) && (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              {timeAgo(message.createdAt)}
            </span>
          </div>

          {/* content */}
          <div
            className={`p-0 transition-colors text-base font-normal leading-6 text-zinc-900 ${
              isMessageSending(message.id) ? "opacity-70" : ""
            } ${
              message.isInternal ? "border-2 border-dashed bg-yellow-500" : ""
            }`}
          >
            <ContentRenderer doc={message.content} isMine={false} />
          </div>
        </div>
      </div>
    </div>
  );
};

// my message component
const MyMessage = ({
  message,
}: {
  message: TicketType["messages"][number];
}) => {
  const { sessionMembers } = useSessionMembersStore();
  const { isMessageSending, withdrawMessage } = useChatStore();
  const { t } = useTranslation();

  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );

  return (
    <div className="flex animate-fadeIn justify-end">
      <div className="flex max-w-[85%]  flex-row-reverse">
        <Avatar className="h-8 w-8 shrink-0 ml-3">
          <AvatarImage
            src={messageSender?.avatar}
            alt={messageSender?.nickname ?? "Unknown"}
          />
          <AvatarFallback>
            {messageSender?.nickname?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2 rounded-xl bg-zinc-100 py-4 px-5 ml-1">
          {/* name and time */}
          <div className="flex items-center gap-2 flex-row-reverse">
            <span className="text-xs font-medium text-muted-foreground">
              {messageSender?.nickname ?? "Unknown"}
              {message.isInternal && (
                <span className="ml-2 text-xs text-yellow-500">(Internal)</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isMessageSending(message.id) && (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              {timeAgo(message.createdAt)}
            </span>
          </div>

          {/* content */}
          <div
            className={`p-0 transition-colors text-base font-normal leading-6 text-zinc-900 ${
              isMessageSending(message.id) ? "opacity-70" : ""
            } ${
              message.isInternal ? "border-2 border-dashed bg-yellow-500" : ""
            }`}
          >
            <ContentRenderer doc={message.content} isMine={true} />
          </div>
        </div>

        {/* action buttons */}
        {!message.withdrawn && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="smIcon"
                className="mt-auto h-9 w-9 py-2 px-3 rounded-lg"
              >
                <Ellipsis className="h-5 w-5 text-zinc-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-fit  p-2 rounded-xl" align="end">
              <div
                className="flex items-center gap-2 px-2 py-2.5 rounded-md cursor-pointer hover:bg-zinc-100 transition-colors"
                onClick={() => withdrawMessage(message.id)}
              >
                <Undo2 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-normal leading-5">
                  {t("withdraw")}
                </span>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};

export function MessageItem({ message }: MessageItemProps) {
  const { id: userId } = useLocalUser();
  const { sessionMembers } = useSessionMembersStore();

  if (!sessionMembers) return null;

  const isMine = message.senderId === userId;

  // render different components based on message sender
  return isMine ? (
    <MyMessage message={message} />
  ) : (
    <OtherMessage message={message} />
  );
}
