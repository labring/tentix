import { Badge } from "../ui/badge.tsx";
import type { TicketsListItemType } from "tentix-server/rpc";
import { useTranslation } from "i18n";
import { PendingIcon, ProgressIcon, DoneIcon } from "../Icons/index.tsx";

export function PriorityBadge({
  priority,
  textSize = "text-[12.8px]",
  textSize2 = "text-[12.8px]",
  height = "h-5",
  width = "w-[42px]",
  width2 = "w-[40px]",
}: {
  priority: TicketsListItemType["priority"];
  textSize?: string;
  textSize2?: string;
  height?: string;
  width?: string;
  width2?: string;
}) {
  const ticketPriorityMap = {
    normal: "---",
    low: "---",
    medium: "P2",
    high: "P1",
    urgent: "P0",
  };
  switch (priority) {
    case "medium":
      return (
        <Badge
          className={`${width} ${textSize} font-medium leading-[140%] text-zinc-600 flex ${height} items-center justify-center gap-2.5 rounded-full border-[0.5px] border-zinc-200 bg-gray-100 px-2.5 py-0.5 hover:bg-gray-100`}
        >
          {ticketPriorityMap[priority]}
        </Badge>
      );
    case "high":
      return (
        <Badge
          className={`${width} ${textSize} font-medium leading-[140%] text-zinc-900 flex ${height} items-center justify-center gap-2.5 rounded-full border-[0.5px] border-blue-200 bg-blue-50 px-2.5 py-0.5 hover:bg-blue-50`}
        >
          {ticketPriorityMap[priority]}
        </Badge>
      );
    case "urgent":
      return (
        <Badge
          className={`${width} ${textSize} font-medium leading-[140%] text-zinc-900 flex ${height} items-center justify-center gap-2.5 rounded-full border-[0.5px] border-red-200 bg-red-50 px-2.5 py-0.5 hover:bg-red-50`}
        >
          {ticketPriorityMap[priority]}
        </Badge>
      );
    default:
      return (
        <Badge
          className={`${width2} ${textSize2} font-normal leading-[140%] text-zinc-600 flex ${height} items-center justify-center gap-2.5 rounded-full border-[0.5px] border-zinc-200 bg-gray-100 px-2.5 py-0.5 hover:bg-gray-100`}
        >
          {"---"}
        </Badge>
      );
  }
}

export function StatusBadge({
  status,
}: {
  status: TicketsListItemType["status"];
}) {
  const { t } = useTranslation();

  function getStatusDisplay(status: TicketsListItemType["status"]) {
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

  const statusDisplay = getStatusDisplay(status);

  return (
    <div className="flex items-center gap-1.5">
      <statusDisplay.icon className={`h-4 w-4 ${statusDisplay.color}`} />
      <span className="text-sm font-medium text-zinc-900 leading-5">
        {statusDisplay.label}
      </span>
    </div>
  );
}
