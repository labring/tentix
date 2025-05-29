import useLocalUser from "@hook/use-local-user.tsx";
import { apiClient } from "@lib/api-client.ts";
import { cn } from "@lib/utils";
import {
  type JSONContentZod,
  type ticketInsertType,
} from "tentix-server/types";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { joinTrans, useTranslation } from "i18n";
import {
  CalendarIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  moduleEnumArray,
  ticketPriorityEnumArray,
} from "tentix-server/constants";
import {
  Button, Calendar, Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle, DescriptionEditor, Input, Label, Popover, PopoverContent, PopoverTrigger, Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, Textarea, useToast
} from "tentix-ui";



export function TicketForm() {
  const { t } = useTranslation();
  const { area } = useLocalUser();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    handleSubmit,
    setValue,
    register,
    control,
    formState: { errors },
  } = useForm<ticketInsertType>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      area,
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: ticketInsertType) => {
      const res = await apiClient.ticket.create.$post({ json: data });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.status || t("ticket_create_failed"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("ticket_created"),
        variant: "default",
      });
      navigate({ to: '/user/tickets/$id', params: { id: data.id.toString() } });
    },
    onError: (error: Error) => {
      toast({
        title: t("ticket_create_failed"),
        description: error.message,
        variant: "destructive",
      });
    }
  });




  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<{ hour: number; minute: number }>({
    hour: 12,
    minute: 0,
  });
  const getDateWithTime = useCallback(() => {
    if (!date) return undefined;
    const newDate = new Date(date);
    newDate.setHours(time.hour);
    newDate.setMinutes(time.minute);
    setValue("occurrenceTime", newDate.toISOString());
    return newDate;
  }, [date, time, setValue]);

  return (
    <div className="p-6">
      <form
        name="ticket-form"
        onSubmit={handleSubmit(
          (data) => {
            createTicketMutation.mutate(data)
          },
          () => {
            toast({
              title: t("plz_fill_all_fields"),
              description: t("missing_fields", {
                fields: Object.keys(errors).join(", "),
              }),
              variant: "destructive",
            });
          }
        )}
      >
        <div className="grid gap-6 p-1">
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader>
              <CardTitle>{joinTrans([t("tkt"), t("details")])}</CardTitle>
              <CardDescription>{t("plz_pvd_info")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title-input">
                  {t("title")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title-input"
                  {...register("title", { required: true })}
                  placeholder={t("title_ph")}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="sspace-y-2 flex flex-col justify-between">
                  <Label htmlFor="module">
                    {t("module")} <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="module"
                    render={({ field }) => (
                      <Select {...field} onValueChange={field.onChange} required>
                        <SelectTrigger id="module">
                          <SelectValue
                            placeholder={joinTrans([t("select"), t("module")])}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {moduleEnumArray.map((module) => (
                            <SelectItem key={module} value={module}>
                              {t(module)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2 flex flex-col justify-between">
                  <Label htmlFor="occurrence-time">
                    {t("occurrence_time")}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="occurrence-time"
                        variant={"outline"}
                        className={cn(
                          "w-[280px] justify-start text-left font-normal",
                          !date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? (
                          format(getDateWithTime() as Date, "PPP p")
                        ) : (
                          <span>{t("occurrence_time_ph")}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        autoFocus={true}
                      />
                      {date && (
                        <div className="border-t p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">
                              {t("time")}
                            </div>
                            <div className="flex space-x-2">
                              <select
                                className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                                value={time.hour}
                                onChange={(e) =>
                                  setTime({
                                    ...time,
                                    hour: Number.parseInt(e.target.value),
                                  })
                                }
                              >
                                {Array.from({ length: 24 }).map((_, i) => (
                                  <option key={i} value={i}>
                                    {i.toString().padStart(2, "0")}
                                  </option>
                                ))}
                              </select>
                              <span className="text-sm">:</span>
                              <select
                                className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                                value={time.minute}
                                onChange={(e) =>
                                  setTime({
                                    ...time,
                                    minute: Number.parseInt(e.target.value),
                                  })
                                }
                              >
                                {Array.from({ length: 60 }).map((_, i) => (
                                  <option key={i} value={i}>
                                    {i.toString().padStart(2, "0")}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {t("desc")} <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <DescriptionEditor
                      {...field}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value as JSONContentZod);
                      }}
                      className="w-full"
                      editorContentClassName="p-5"
                      output="json"
                      placeholder={t("desc_ph")}
                      autofocus={true}
                      editable={true}
                      editorClassName="focus:outline-hidden"
                    />
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority">
                    {t("priority")} <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <Select {...field} onValueChange={field.onChange} required>
                        <SelectTrigger id="priority">
                          <SelectValue
                            placeholder={joinTrans([
                              t("select"),
                              t("priority"),
                            ])}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {ticketPriorityEnumArray
                            .filter((priority) => priority !== "urgent")
                            .map((priority) => (
                              <SelectItem key={priority} value={priority}>
                                {t(priority, { context: "desc" })}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="error-message">{t("error_msg")}</Label>
                <Textarea
                  id="error-message"
                  placeholder={t("error_msg_ph")}
                  className="min-h-20"
                  {...register("errorMessage")}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex items-start space-x-2 justify-between">
          <Button 
            type="submit" 
            className="ml-auto"
            // disabled={createTicketMutation.isPending}
          >
           { t("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
