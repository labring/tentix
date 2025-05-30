import { zodResolver } from "@hookform/resolvers/zod";
import { staffListQueryOptions, useSuspenseQuery } from "@lib/query";
import { useMutation } from "@tanstack/react-query";
import { useBoolean } from "ahooks";
import { useTranslation } from "i18n";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Avatar,
  AvatarFallback,
  AvatarImage, Button, Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle, Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage, Input, Label, RadioGroup, RadioGroupItem, Textarea, toast
} from "tentix-ui";
import { z } from "zod";
import useLocalUser from "@hook/use-local-user";
import { apiClient } from "@lib/api-client";

// Define the form schema with zod
const transferFormSchema = z.object({
  staffId: z.string({
    required_error: "Please select a staff member",
  }),
  reason: z
    .string({
      required_error: "Please provide a reason for transfer",
    })
    .min(3, {
      message: "Reason must be at least 3 characters",
    }),
  remarks: z.string().optional(),
});

// Define the form values type
type TransferFormValues = z.infer<typeof transferFormSchema>;

async function transferTicket({
  ticketId,
  targetStaffId,
  description,
}: {
  ticketId: string;
  targetStaffId: number;
  description: string;
}) {
  const res = await (
    await apiClient.ticket.transfer.$post({
      json: {
        ticketId,
        targetStaffId,
        description,
      },
    })
  ).json();
  if (res.success) {
    return res;
  }
  throw new Error(res.message);
}

export function useTransferModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [ticketId, setTicketId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const user = useLocalUser();
  const { t } = useTranslation();

  // Get staff list from API
  const { data: staffList } = useSuspenseQuery(staffListQueryOptions());

  // Initialize form with React Hook Form
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      staffId: "",
      reason: "",
    },
  });

  // Setup mutation for transferring the ticket
  const transferMutation = useMutation({
    mutationFn: transferTicket,
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("ticket_transferred"),
        variant: "default",
      });
      setFalse();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_transfer"),
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: TransferFormValues) => {
    console.log(values);
    transferMutation.mutate({
      ticketId,
      targetStaffId: parseInt(values.staffId),
      description: values.reason,
    });
  };

  // Function to open the transfer modal
  function openTransferModal(ticketId: string) {
    setTrue();
    setTicketId(ticketId);
    form.reset();
  }

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{t("transfer_ticket", { id: ticketId })}</DialogTitle>
          <DialogDescription>
            {t("transfer_desc")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>{t("select_staff")}</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder={t("search_staff")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mb-2"
                      />
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid gap-2 h-72 overflow-y-auto"
                      >
                        {staffList
                          .filter((staff) => staff.id !== user.id)
                          .filter(
                            (staff) =>
                              staff.name
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              staff.role
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase()),
                          )
                          .map((staff) => (
                            <div
                              key={staff.id}
                              className={`flex items-center space-x-2 rounded-md border p-3 h-16 ${
                                field.value === staff.id.toString()
                                  ? "border-primary"
                                  : ""
                              }`}
                            >
                              <RadioGroupItem
                                value={staff.id.toString()}
                                id={`staff-${staff.id}`}
                                className="sr-only"
                              />
                              <Label
                                htmlFor={`staff-${staff.id}`}
                                className="flex flex-1 cursor-pointer items-center gap-3"
                              >
                                <Avatar>
                                  <AvatarImage
                                    src={staff.avatar || "/placeholder.svg"}
                                    alt={staff.name}
                                  />
                                  <AvatarFallback>
                                    {staff.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {staff.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {staff.role}
                                  </div>
                                </div>
                                <div
                                  className={`rounded-full px-2 py-1 text-xs ${
                                    staff.workload === "Low"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                      : staff.workload === "Medium"
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                  }`}
                                >
                                  {staff.ticketNum} {t("tkt_other")}
                                </div>
                              </Label>
                            </div>
                          ))}
                      </RadioGroup>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("transfer_reason")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("transfer_reason_ph")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={setFalse}
                disabled={transferMutation.isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || transferMutation.isPending}
              >
                {transferMutation.isPending
                  ? t("transferring")
                  : t("transfer_ticket_btn")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openTransferModal,
    closeTransferModal: setFalse,
    transferModal: modal,
    isTransferring: transferMutation.isPending,
  };
}
