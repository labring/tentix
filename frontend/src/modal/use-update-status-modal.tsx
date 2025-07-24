import { zodResolver } from "@hookform/resolvers/zod";
import { updateTicketStatus } from "@lib/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoolean } from "ahooks";
import { useTranslation } from "i18n";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ticketStatusEnumArray } from "tentix-server/constants";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  toast,
} from "tentix-ui";
import { z } from "zod";

// Define the form schema with zod
const updateStatusFormSchema = z.object({
  status: z.enum(ticketStatusEnumArray, {
    required_error: "Please select a status",
  }),
  reason: z
    .string({
      required_error: "Please provide a reason for status change",
    })
    .min(3, {
      message: "Reason must be at least 3 characters",
    }),
});

// Define the form values type
type UpdateStatusFormValues = z.infer<typeof updateStatusFormSchema>;

export function useUpdateStatusModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [ticketId, setTicketId] = useState<string>("");
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Initialize form with React Hook Form
  const form = useForm<UpdateStatusFormValues>({
    resolver: zodResolver(updateStatusFormSchema),
    defaultValues: {
      status: undefined,
      reason: "",
    },
  });

  // Setup mutation for updating the ticket status
  const updateStatusMutation = useMutation({
    mutationFn: updateTicketStatus,
    onSuccess: (data) => {
      toast({
        title: t("success"),
        description: data.message || t("status_updated"),
        variant: "default",
      });
      // Invalidate all ticket-related queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["getAllTickets"],
      });
      queryClient.invalidateQueries({
        queryKey: ["getUserTickets"],
      });
      queryClient.invalidateQueries({
        queryKey: ["getTicket", ticketId],
      });
      setFalse();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_update_status"),
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: UpdateStatusFormValues) => {
    updateStatusMutation.mutate({
      ticketId,
      status: values.status,
      description: values.reason,
    });
  };

  // Function to open the update status modal
  function openUpdateStatusModal(ticketId: string, currentStatus: string) {
    setTrue();
    setTicketId(ticketId);
    form.reset({
      status: currentStatus as any,
      reason: "",
    });
  }

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("update_status_title")}</DialogTitle>
          <DialogDescription>
            {t("update_status_desc", { id: ticketId })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>{t("select_status")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-2 gap-2"
                    >
                      {ticketStatusEnumArray.map((status) => (
                        <div
                          key={status}
                          className={`flex items-center space-x-2 rounded-md border p-3 ${
                            field.value === status ? "border-primary" : ""
                          }`}
                        >
                          <RadioGroupItem
                            value={status}
                            id={`status-${status}`}
                            className="sr-only"
                          />
                          <Label
                            htmlFor={`status-${status}`}
                            className="flex flex-1 cursor-pointer items-center"
                          >
                            <div className="text-sm font-medium">
                              {t(status)}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
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
                  <FormLabel>{t("status_change_reason")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("status_change_reason_ph")}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t("status_change_desc")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={setFalse}
                disabled={updateStatusMutation.isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  !form.formState.isValid || updateStatusMutation.isPending
                }
              >
                {updateStatusMutation.isPending
                  ? t("updating")
                  : t("update_status")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openUpdateStatusModal,
    closeUpdateStatusModal: setFalse,
    updateStatusModal: modal,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
}
