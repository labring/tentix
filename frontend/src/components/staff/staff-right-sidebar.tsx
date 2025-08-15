import { useSessionMembersStore } from "@store/index";
import { useTranslation } from "i18n";
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
  ScrollArea,
  timeAgo,
  PendingIcon,
  ProgressIcon,
  DoneIcon,
  PriorityBadge,
} from "tentix-ui";
import { TruncateWithTooltip } from "@comp/common/truncate-with-tooltip";
import type { TFunction } from "i18next";

// Custom status display function
function getStatusDisplay(status: TicketType["status"], t: TFunction) {
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
  const { t } = useTranslation();
  const memberName =
    sessionMembers?.find((member) => member.id === history.meta)?.nickname ??
    t("system");
  const operatorName =
    sessionMembers?.find((member) => member.id === history.operatorId)?.name ??
    t("system");

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

export function StaffRightSidebar({ ticket }: { ticket: TicketType }) {
  const { t } = useTranslation();
  const agent = ticket?.agent;
  const customer = ticket.customer;
  const statusDisplay = getStatusDisplay(ticket?.status, t);

  if (ticket) {
    return (
      <div className="flex flex-col h-full border-l">
        <div className="flex-shrink-0 p-5 space-y-6">
          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("user_info")}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Name */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("name")}
              </div>
              <TruncateWithTooltip className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5" maxWidth={100}>
                {customer.name}
              </TruncateWithTooltip>

              {/* sealos ID */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("sealos_id")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {customer.sealosId}
              </div>
              {/* Region */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("area")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {ticket.area}
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-200"></div>

          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("basic_info")}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Status */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("status")}
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
                {t("ticket_id")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {ticket.id}
              </div>

              {/* priority */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("priority")}
              </div>
              <div className=" flex items-center h-5">
                <PriorityBadge
                  priority={ticket.priority}
                  textSize="text-[12px]"
                  textSize2="text-[8px]"
                  height="h-[20px]"
                  width="w-[37px]"
                  width2="w-[35px]"
                />
              </div>

              {/* Created At */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("created_at")}
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

              {/* Last Updated */}
              <div className="text-zinc-500 text-sm font-normal leading-none flex items-center h-5">
                {t("updated_at")}
              </div>
              <div className="text-zinc-900 text-sm font-normal leading-none flex items-center h-5">
                {timeAgo(ticket.updatedAt)}
              </div>
            </div>
          </div>
          <div className="h-px bg-zinc-200"></div>

          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("assignees")}
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
        </div>

        <div className="flex-1 min-h-0 px-5 pb-5">
          <div className="flex flex-col gap-4 h-full">
            <p className="text-black text-sm font-semibold leading-none">
              {t("activity")}
            </p>

            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-4">
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
