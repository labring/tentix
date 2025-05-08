import { Badge } from "../ui/badge.tsx";
import { TicketsListItemType } from "tentix-ui/lib/types";
import { useTranslation } from "i18n";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
} from "lucide-react";

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
  function getStatusIcon(status: TicketsListItemType["status"]) {
    switch (status) {
      case "resolved":
        return (
          <>
            <CheckCircle2Icon className="text-green-500 dark:text-green-400" />
            {t("resolved")}
          </>
        );
      case "in_progress":
        return (
          <>
            <Loader2Icon className="text-amber-500 dark:text-amber-400" />
            {t("in_progress")}
          </>
        );
      case "pending":
        return (
          <>
            <ClockIcon className="text-blue-500 dark:text-blue-400" />
            {t("pending")}
          </>
        );
      case "scheduled":
        return (
          <>
            <ClockIcon className="text-purple-500 dark:text-purple-400" />
            {t("scheduled")}
          </>
        );
      default:
        return (
          <>
            <AlertTriangleIcon className="text-red-500 dark:text-red-400" />
            {t("pending")}
          </>
        );
    }
  }

  return (
    <Badge
      variant="outline"
      className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3 w-fit"
    >
      {getStatusIcon(status)}
    </Badge>
  );
}
