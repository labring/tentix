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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PriorityBadge,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  StatusBadge,
  Tabs,
  TabsContent,
  toast,
  useLeftResizablePanel,
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
  const { LeftResizablePanel } = useLeftResizablePanel({
    defaultWidth: 250,
    minWidth: 250,
    maxWidth: 500,
  });

  const { data: ticket, isSuccess } = useQuery(ticketsQueryOptions(id));

  console.log(ticket);

  // const [activeTab, setActiveTab] = useState<string>("user");
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
      <div className="hidden border-l md:block max-h-full">
        <LeftResizablePanel>
          <Tabs
            defaultValue="user"
            className="h-full"
            // onValueChange={setActiveTab}
          >
            {/* <div className="border-b px-4 py-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="user">User</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>
          </div> */}

            <ScrollArea className="w-full p-4">
              <TabsContent
                value="user"
                className="mt-0 space-y-4 h-full w-full"
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("info")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={customer.avatar}
                          alt={customer.name}
                        />
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

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t("rqst_by")}</Label>
                        <p className="text-sm">{customer.sealosId}</p>
                      </div>
                      <div>
                        <Label className="text-xs">{t("nickname")}</Label>
                        <p className="text-sm">{customer.nickname}</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">{t("module")}</Label>
                      <p className="text-sm">{t(ticket.module)}</p>
                    </div>

                    <div>
                      <Label className="text-xs">{t("area")}</Label>
                      <p className="text-sm">{ticket.area}</p>
                    </div>

                    {/* <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    View User Profile
                  </Button> */}
                  </CardContent>
                </Card>

                <Card className="w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("details")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <Label className="text-xs">{t("title")}</Label>
                      <p className="text-sm font-medium">{ticket.title}</p>
                    </div>

                    <div>
                      <Label className="text-xs mr-2">{t("category")}</Label>
                      {ticket.category === "uncategorized" ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline">
                              {t("uncategorized")}（{t("assign_category")}）
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent>
                            <RadioGroup
                              className="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4 max-w-72"
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
                                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
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
                        <p className="text-sm">{t(ticket.category)}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">
                          {`${t("tkt_one")} ID`}
                        </Label>
                        <p className="text-sm">{ticket.id}</p>
                      </div>
                      <div>
                        <Label className="text-xs">{t("status")}</Label>
                        <StatusBadge status={ticket.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t("created_at")}</Label>
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(ticket.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">{t("occurrence_time")}</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(ticket.occurrenceTime).toLocaleString()}
                      </div>
                    </div>

                    {ticket.errorMessage && (
                      <div>
                        <Label className="text-xs">{t("error_msg")}</Label>
                        <p className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
                          {ticket.errorMessage}
                        </p>
                      </div>
                    )}

                    <div className="border-t pt-3">
                      <Label className="text-xs">{t("assigned_to")}</Label>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage
                              src={assignedTo.avatar}
                              alt={assignedTo.name}
                            />
                            <AvatarFallback>
                              {assignedTo.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium">
                            {assignedTo.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">{t("priority")}</Label>
                      <div className="flex items-center justify-between">
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("activity")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
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
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </LeftResizablePanel>
      </div>
    );
  }
}
