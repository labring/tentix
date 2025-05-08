import {
  JSONContentZod,
  ticketSessionInsertType,
} from "@server/utils/types.ts";
import {
  BugIcon,
  CalendarIcon,
  FileTextIcon,
  LightbulbIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Button } from "../ui/button.tsx";
import { Checkbox } from "../ui/checkbox.tsx";
import { Label } from "../ui/label.tsx";
import { ServiceAgreementModal } from "./service-agreement-modal.tsx";

import { format } from "date-fns";
import { useCallback } from "react";
import { apiClient, cn } from "tentix-ui/lib/utils";
import { Calendar } from "../ui/calendar.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card.tsx";
import { Input } from "../ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.tsx";
import { Textarea } from "../ui/textarea.tsx";
import {
  moduleEnumArray,
  ticketCategoryEnumArray,
  ticketPriorityEnumArray,
} from "@server/utils/const.ts";
import { useToast } from "../../hooks/use-toast.ts";
import DescriptionEditor from "../minimal-tiptap/description-editor.tsx";
import { joinTrans, useTranslation } from "i18n";
import useLocalUser from "tentix-ui/hooks/use-local-user.tsx";

const IconMap: Record<
  (typeof ticketCategoryEnumArray)[number],
  React.ReactNode
> = {
  bug: <BugIcon className="mb-2 h-4 w-4" />,
  feature: <LightbulbIcon className="mb-2 h-4 w-4" />,
  question: <FileTextIcon className="mb-2 h-4 w-4" />,
  other: <PlusIcon className="mb-2 h-4 w-4" />,
};

export function TicketForm() {
  const { t } = useTranslation();
  const { area } = useLocalUser();
  const [agreementChecked, setAgreementChecked] = useState<boolean>(true);
  const [agreementOpen, setAgreementOpen] = useState<boolean>(false);

  const handleAgreementClick = () => {
    if (!agreementChecked) {
      setAgreementOpen(true);
    }
  };

  const handleAgreementConfirm = () => {
    setAgreementChecked(true);
    setAgreementOpen(false);
  };

  const {
    handleSubmit,
    setValue,
    register,
    control,
    formState: { errors, isValid },
  } = useForm<ticketSessionInsertType>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      area: area,
    },
  });

  const onSubmit: SubmitHandler<ticketSessionInsertType> = (data) => {
    console.log(data);
    apiClient.ticket.create.$post({ json: data });
  };

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
  const { toast } = useToast();

  return (
    <div className="p-6">
      <form
        name="ticket-form"
        onSubmit={(e) => {
          e.preventDefault();
          console.log("error:", errors, isValid);
          if (!isValid) {
            toast({
              title: t("plz_fill_all_fields"),
              description: t("missing_fields", {
                fields: Object.keys(errors).join(", "),
              }),
              variant: "destructive",
            });
          }
          handleSubmit(onSubmit)();
          console.log(handleSubmit(onSubmit));
        }}
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
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger id="module">
                          <SelectValue placeholder={joinTrans([t("select"), t("module")])} />
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
                <Label>
                  {joinTrans([t("tkt"), t("type")])}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <RadioGroup
                      defaultValue="bug"
                      className="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4 max-w-96"
                      required
                      {...field}
                      onValueChange={field.onChange}
                    >
                      {ticketCategoryEnumArray.map((category) => (
                        <div key={category}>
                          <RadioGroupItem
                            value={category}
                            id={category}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={category}
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            {IconMap[category]}
                            {t(category)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
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
                        console.log(value);
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
                      <Select {...field} onValueChange={field.onChange}>
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

              {/* <AffectedResourcesSelector
                selectedResources={selectedResources}
                setSelectedResources={setSelectedResources}
              /> */}

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
          {/* <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              required
              className="mt-1"
              checked={agreementChecked}
              onCheckedChange={handleAgreementClick}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="terms" className="font-normal text-sm">
                I have read and agree to the
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setAgreementOpen(true);
                  }}
                >
                  &quot;Service Agreement&quot;
                </Button>
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Submitting a ticket means you agree to our terms of service and
                privacy policy
              </p>
            </div>
          </div> */}
          <Button type="submit" className="ml-auto">
            {joinTrans([t("submit"), t("tkt")])}
          </Button>
        </div>
      </form>
      <ServiceAgreementModal
        open={agreementOpen}
        onOpenChange={setAgreementOpen}
        onConfirm={handleAgreementConfirm}
      />
    </div>
  );
}
