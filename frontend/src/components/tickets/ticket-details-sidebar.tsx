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
import { getEnumKey, ticketCategoryEnumArray, ticketPriorityEnumArray } from "tentix-server/constants";
import { type TicketType } from "tentix-server/rpc";
import { Avatar, AvatarFallback, AvatarImage, Card, CardContent, CardHeader, CardTitle, PriorityBadge, ScrollArea, StatusBadge, timeAgo } from "tentix-ui";

function IconforHistory({
  type,
}: {
  type: TicketType["ticketHistory"][number]["type"];
}) {
  switch (type) {
    case "create":
      return <CheckCircleIcon className="h-3 w-3 text-green-500" />;
    case "upgrade":
      return <ArrowUpCircleIcon className="h-3 w-3 text-blue-500" />;
    case "update":
      return <PencilIcon className="h-3 w-3 text-blue-500" />;
    // case "create":
    //   return <PlusIcon className="h-3 w-3 text-blue-500" />;
    case "resolve":
      return <CheckCircleIcon className="h-3 w-3 text-green-500" />;
    case "close":
      return <XIcon className="h-3 w-3 text-red-500" />;
    case "transfer":
      return <ArrowUpCircleIcon className="h-3 w-3 text-blue-500" />;
    case "makeRequest":
      return <PlusIcon className="h-3 w-3 text-blue-500" />;
    default:
      return <MessageSquareIcon className="h-3 w-3 text-blue-500" />;
  }
}

export function TicketHistory({
  history,
}: {
  history: TicketType["ticketHistory"][number];
}) {
  const { sessionMembers } = useSessionMembersStore();
  const memberName = sessionMembers?.find(
    (member) => member.id === history.meta,
  )?.nickname ?? "System";
  const operatorName = sessionMembers?.find(
    (member) => member.id === history.operatorId,
  )?.nickname ?? "System";
  const { t } = useTranslation();

  const text = () => {
    switch (history.type) {
      case "create":
        return t(`tktH.create`, { assignee: memberName });
      case "upgrade":
        return t(`tktH.upgrade`, { priority: t(getEnumKey(ticketPriorityEnumArray, history.meta!) ?? "unknown") });
      case "transfer":
        return t(`tktH.transfer`, { assignee: memberName });
      case "join":
        return t(`tktH.join`, { member: memberName });
      case "category":
        return t(`tktH.category`, { category: t(getEnumKey(ticketCategoryEnumArray, history.meta!) ?? "unknown") });
      default:
        return t(`tktH.${history.type}`);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted">
        <IconforHistory type={history.type} />
      </div>
      <div className="flex-1">
        <p className="font-medium">{text()}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
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


  if (agent) {
    return (
      <div className="hidden md:block border-l">
        <ScrollArea className="h-[calc(100vh-48px)]">
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {joinTrans([t("tkt_one"), t("info")])}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{t("status")}</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("priority")}</span>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("assigned_to")}</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={agent.avatar} />
                      <AvatarFallback>
                        {agent.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {agent.name}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {joinTrans([t("tkt_one"), t("details")])}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t('area')}
                    </span>
                    <p>{ticket.area}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t('category')}
                    </span>
                    <p>{ticket.category}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* <div>
                  <span className="text-xs text-muted-foreground">Subcategory</span>
                  <p>{ticket.ticketDetails.subcategory}</p>
                </div> */}
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t('occurrence_time')}
                    </span>
                    <p>{t("dateTime", { val: ticket.createdAt })}</p>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    {t('last_updated')}
                  </span>
                  <p>{timeAgo(ticket.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Activity</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="space-y-3">
                  {ticket.ticketHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((history) => (
                    <TicketHistory key={history.id} history={history} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    );
  }
}
