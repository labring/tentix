import { Badge } from "../ui/badge.tsx";
import type { TicketsListItemType } from "tentix-server/rpc";
import { useTranslation } from "i18n";
import { PendingIcon, ProgressIcon, DoneIcon } from "../Icons/index.tsx";

export function PriorityBadge({
  priority,
}: {
  priority: TicketsListItemType["priority"];
}) {
  const { t } = useTranslation();
  switch (priority) {
    case "urgent":
      return (
        <Badge className="w-fit bg-red-500 hover:bg-red-600">
          {t("urgent")}
        </Badge>
      );
    case "high":
      return (
        <Badge className="w-fit bg-orange-500 hover:bg-orange-600">
          {t("high")}
        </Badge>
      );
    case "medium":
      return (
        <Badge className="w-fit bg-amber-500 hover:bg-amber-600">
          {t("medium")}
        </Badge>
      );
    case "low":
      return (
        <Badge className="w-fit bg-green-500 hover:bg-green-600">
          {t("low")}
        </Badge>
      );
    case "normal":
      return (
        <Badge className="w-fit bg-blue-500 hover:bg-blue-600">
          {t("normal")}
        </Badge>
      );
    default:
      return <Badge>{priority}</Badge>;
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
      <statusDisplay.icon
        className={`h-4 w-4 ${statusDisplay.color}`}
      />
      <span className="text-sm font-medium text-zinc-900 leading-5">
        {statusDisplay.label}
      </span>
    </div>
  );
}
