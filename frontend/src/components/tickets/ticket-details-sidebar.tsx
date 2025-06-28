import { useSessionMembersStore } from "@store/index";
import { joinTrans } from "i18n";
import {
  ArrowUpCircleIcon,
  CheckCircleIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getEnumKey,
  ticketCategoryEnumArray,
  ticketPriorityEnumArray,
} from "tentix-server/constants";
import { type TicketType } from "tentix-server/rpc";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PriorityBadge,
  ScrollArea,
  StatusBadge,
  timeAgo,
  PendingIcon,
  ProgressIcon,
  DoneIcon,
} from "tentix-ui";

// Custom status display function
function getStatusDisplay(
  status: TicketType["status"],
  t: (key: string) => string,
) {
  switch (status) {
    case "pending":
    case "scheduled":
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-blue-600",
      };
    case "in_progress":
      return {
        label: t("in_progress"),
        icon: ProgressIcon,
        color: "text-yellow-500",
      };
    case "resolved":
      return {
        label: t("resolved"),
        icon: DoneIcon,
        color: "text-blue-600",
      };
    default:
      return {
        label: t("pending"),
        icon: PendingIcon,
        color: "text-blue-600",
      };
  }
}

export function TicketHistory({
  history,
}: {
  history: TicketType["ticketHistory"][number];
}) {
  const { sessionMembers } = useSessionMembersStore();
  const memberName =
    sessionMembers?.find((member) => member.id === history.meta)?.nickname ??
    "System";
  const operatorName =
    sessionMembers?.find((member) => member.id === history.operatorId)?.name ??
    "System";
  const { t } = useTranslation();

  const text = () => {
    switch (history.type) {
      case "create":
        return t(`tktH.create`, { assignee: memberName });
      case "upgrade":
        return t(`tktH.upgrade`, {
          priority: t(
            getEnumKey(ticketPriorityEnumArray, history.meta!) ?? "unknown",
          ),
        });
      case "transfer":
        return t(`tktH.transfer`, { assignee: memberName });
      case "join":
        return t(`tktH.join`, { member: memberName });
      case "category":
        return t(`tktH.category`, {
          category: t(
            getEnumKey(ticketCategoryEnumArray, history.meta!) ?? "unknown",
          ),
        });
      default:
        return t(`tktH.${history.type}`);
    }
  };

  return (
    <div className="flex flex-row items-start gap-4">
      <div className="w-0.5 self-stretch rounded-sm bg-emerald-400"></div>
      <div className="flex-1 flex-col gap-1">
        <p className="text-zinc-900 text-sm font-medium leading-5 tracking-wide">
          {text()}
        </p>
        <div className="flex items-center gap-1 text-zinc-500 text-sm font-normal leading-5">
          <span>{operatorName}</span>
          <span>•</span>
          <span>{timeAgo(history.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function TicketDetailsSidebar({ ticket }: { ticket: TicketType }) {
  const { t } = useTranslation();
  const agent = ticket.agent;
  const statusDisplay = getStatusDisplay(ticket.status, t);

  if (agent) {
    return (
      <div className="flex-1 min-h-0 border-l">
        <div className="p-5 space-y-6">
          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {"Basic Info"}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Status */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                Status
              </div>
              <div className="flex items-center gap-1.5 justify-start h-5">
                <statusDisplay.icon
                  className={`h-4 w-4 ${statusDisplay.color}`}
                />
                <span className="text-zinc-900 text-sm font-medium leading-5 ml-1.5">
                  {statusDisplay.label}
                </span>
              </div>

              {/* Ticket ID */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                Ticket ID
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {ticket.id}
              </div>

              {/* Created At */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                Created At
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {new Date(ticket.createdAt).toLocaleString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {/* Region */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                Region
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {ticket.area}
              </div>

              {/* Last Updated */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                Last Updated
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {timeAgo(ticket.updatedAt)}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-200"></div>

          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {"Assignees"}
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={agent.avatar} />
                  <AvatarFallback>{agent.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{agent.name}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-200"></div>

          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {"Activity"}
            </p>

            <ScrollArea className="h-full">
              <div className="space-y-3">
                {ticket.ticketHistory
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  )
                  .map((history) => (
                    <TicketHistory key={history.id} history={history} />
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  }
}
