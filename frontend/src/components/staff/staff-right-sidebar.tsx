import { apiClient } from "@lib/api-client.ts";
import { ticketsQueryOptions } from "@lib/query.ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "i18n";
import {
  BugIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  LightbulbIcon,
  PlusIcon,
} from "lucide-react";
import { getQueryClient } from "src/_provider/tanstack.tsx";
import { ticketCategoryEnumArray } from "tentix-server/constants";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PriorityBadge,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  StatusBadge,
  toast,
} from "tentix-ui";
import { TicketHistory } from "../tickets/ticket-details-sidebar.tsx";

type NormalCategory = Exclude<
  (typeof ticketCategoryEnumArray)[number],
  "uncategorized"
>;

const IconMap: Record<NormalCategory, React.ReactNode> = {
  bug: <BugIcon className="mb-2 h-4 w-4" />,
  feature: <LightbulbIcon className="mb-2 h-4 w-4" />,
  question: <FileTextIcon className="mb-2 h-4 w-4" />,
  other: <PlusIcon className="mb-2 h-4 w-4" />,
};

export function StaffRightSidebar({ id }: { id: string }) {
  const { data: ticket, isSuccess } = useQuery(ticketsQueryOptions(id));

  console.log(ticket);

  const { t } = useTranslation();

  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      ticketId,
      category,
    }: {
      ticketId: string;
      category: NormalCategory;
    }) => {
      return apiClient.ticket.category.$post({
        form: {
          ticketId,
          category,
        },
      });
    },
    onSuccess: async () => {
      toast({ title: t("success"), description: t("category_updated") });
      // Force refetch the ticket data
      await getQueryClient().invalidateQueries({
        queryKey: ["getTicket", id],
        refetchType: "active",
        exact: true,
      });
    },
  });

  if (isSuccess) {
    const customer = ticket.customer;
    const assignedTo = ticket.agent;

    return (
      <div className="flex flex-col h-full border-l">
        <div className="flex-shrink-0 p-5 space-y-6">
          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("info")}
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={customer.avatar} alt={customer.name} />
                  <AvatarFallback>
                    {customer.name.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.role}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                  {t("rqst_by")}
                </div>
                <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                  {customer.sealosId}
                </div>

                <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                  {t("nickname")}
                </div>
                <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                  {customer.nickname}
                </div>

                <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                  {t("module")}
                </div>
                <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                  {t(ticket.module)}
                </div>

                <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                  {t("area")}
                </div>
                <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                  {ticket.area}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-200"></div>

          <div className="flex flex-col gap-4">
            <p className="text-black text-sm font-semibold leading-none">
              {t("details")}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("title")}
              </div>
              <div className="text-zinc-900 font-medium leading-none flex items-center h-5">
                {ticket.title}
              </div>

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("category")}
              </div>
              <div className="flex items-center h-5">
                {ticket.category === "uncategorized" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs h-6 px-2">
                        {t("uncategorized")}（{t("assign_category")}）
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <RadioGroup
                        className="grid grid-cols-2 gap-1 pt-1 md:grid-cols-4 max-w-72"
                        onValueChange={(val: NormalCategory) => {
                          updateCategoryMutation.mutate({
                            ticketId: ticket.id,
                            category: val,
                          });
                        }}
                      >
                        {ticketCategoryEnumArray
                          .filter((cat) => cat !== "uncategorized")
                          .map((cat: NormalCategory) => (
                            <div key={cat}>
                              <RadioGroupItem
                                value={cat}
                                id={cat}
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor={cat}
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-1 text-[10px] hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                              >
                                {IconMap[cat]}
                                {t(cat)}
                              </Label>
                            </div>
                          ))}
                      </RadioGroup>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-zinc-900 font-normal leading-none">
                    {t(ticket.category)}
                  </span>
                )}
              </div>

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {`${t("tkt_one")} ID`}
              </div>
              <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                {ticket.id}
              </div>

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("status")}
              </div>
              <div className="flex items-center h-5">
                <StatusBadge status={ticket.status} />
              </div>

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("created_at")}
              </div>
              <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {new Date(ticket.createdAt).toLocaleString()}
              </div>

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("occurrence_time")}
              </div>
              <div className="text-zinc-900 font-normal leading-none flex items-center h-5">
                <ClockIcon className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {new Date(ticket.occurrenceTime).toLocaleString()}
              </div>

              {ticket.errorMessage && (
                <>
                  <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                    {t("error_msg")}
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
                      {ticket.errorMessage}
                    </p>
                  </div>
                </>
              )}

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("assigned_to")}
              </div>
              <div className="flex items-center gap-2 h-5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assignedTo.avatar} alt={assignedTo.name} />
                  <AvatarFallback>{assignedTo.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-zinc-900 font-medium leading-none">
                  {assignedTo.name}
                </span>
              </div>

              <div className="text-zinc-500 font-normal leading-none flex items-center h-5">
                {t("priority")}
              </div>
              <div className="flex items-center h-5">
                <PriorityBadge priority={ticket.priority} />
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
