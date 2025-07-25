import {
  Ellipsis,
  Loader2Icon,
  Undo2,
  HeadsetIcon,
  UserIcon,
  EyeOffIcon,
} from "lucide-react";
import { type TicketType } from "tentix-server/rpc";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
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
import { memo } from "react";
import { cn } from "@lib/utils";

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
  const { role } = useLocalUser();
  const notCustomer = role !== "customer";

  const messageSender = sessionMembers?.find(
    (member) => member.id === message.senderId,
  );

  return (
    <div className="flex animate-fadeIn justify-start">
      <div className="flex max-w-[85%] gap-3 min-w-0">
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
          className={cn(
            "flex flex-col gap-2 min-w-0 flex-1",
            message.isInternal ? "bg-violet-50 rounded-xl py-4 px-5" : "",
          )}
        >
          {/* name and time */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {messageSender?.name ?? "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isMessageSending(message.id) && (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              {timeAgo(message.createdAt)}
            </span>
            {notCustomer && (
              <>
                <div className="w-px h-[18px] bg-zinc-200"></div>
                <Badge
                  className={cn(
                    "border-zinc-200 bg-zinc-50  gap-1 justify-center items-center rounded border",
                    message.isInternal ? "border-violet-200 bg-violet-100" : "",
                  )}
                >
                  {messageSender?.role === "customer" ? (
                    <UserIcon className="h-3 w-3 text-zinc-500" />
                  ) : (
                    <HeadsetIcon className="h-3 w-3 text-zinc-500" />
                  )}
                  {messageSender?.role === "customer" ? (
                    <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                      {"User"}
                    </span>
                  ) : (
                    <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                      {"CSR"}
                    </span>
                  )}
                </Badge>
                {message.isInternal && (
                  <>
                    <div className="w-px h-[18px] bg-zinc-200"></div>
                    <Badge className="flex items-center justify-center gap-1 rounded border-[0.5px] border-violet-200 bg-violet-100 px-1.5">
                      <EyeOffIcon className="h-3 w-3 text-zinc-500" />
                      <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                        {"Internal"}
                      </span>
                    </Badge>
                  </>
                )}
              </>
            )}
          </div>

          {/* content */}
          <div
            className={cn(
              "p-0 transition-colors text-base font-normal leading-6 text-zinc-900 break-words break-all overflow-hidden",
              isMessageSending(message.id) ? "opacity-70" : "",
            )}
          >
            <ContentRenderer doc={message.content} isMine={false} />
            {/* {message.readStatus.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {message.readStatus.map((status) => status.userId).join(", ")}
              </div>
            )} */}
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
      <div className="flex max-w-[85%]  flex-row-reverse min-w-0">
        <Avatar className="h-8 w-8 shrink-0 ml-3">
          <AvatarImage
            src={messageSender?.avatar}
            alt={messageSender?.nickname ?? "Unknown"}
          />
          <AvatarFallback>
            {messageSender?.nickname?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl py-4 px-5 ml-1 min-w-0 flex-1",
            message.isInternal ? "bg-violet-50" : "bg-zinc-100",
          )}
        >
          {/* name and time */}
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {messageSender?.name ?? "Unknown"}
              </span>

              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {isMessageSending(message.id) && (
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                )}
                {timeAgo(message.createdAt)}
              </span>
            </div>
            {message.isInternal && (
              <>
                <div className="w-px h-[18px] bg-zinc-200"></div>
                <Badge className="flex items-center justify-center gap-1 rounded border-[0.5px] border-violet-200 bg-violet-100 px-1.5">
                  <EyeOffIcon className="h-3 w-3 text-zinc-500" />
                  <span className="text-zinc-900 font-medium text-[12.8px] leading-[140%]">
                    {"Internal"}
                  </span>
                </Badge>
              </>
            )}
          </div>

          {/* content */}
          <div
            className={cn(
              "p-0 transition-colors text-base font-normal leading-6 text-zinc-900 break-words break-all overflow-hidden",
              isMessageSending(message.id) ? "opacity-70" : "",
            )}
          >
            <ContentRenderer doc={message.content} isMine={true} />
            {/* {message.readStatus.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {message.readStatus.map((status) => status.userId).join(", ")}
              </div>
            )} */}
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

const MessageItem = ({ message }: MessageItemProps) => {
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
};

export default memo(MessageItem);
