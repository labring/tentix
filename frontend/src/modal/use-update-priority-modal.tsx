import { zodResolver } from "@hookform/resolvers/zod";
import { updateTicketPriority } from "@lib/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoolean } from "ahooks";
import { useTranslation } from "i18n";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ticketPriorityEnumArray } from "tentix-server/constants";
import { CheckIcon } from "lucide-react";
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
  FormField,
  FormItem,
  FormMessage,
  toast,
  PriorityBadge,
  cn,
} from "tentix-ui";
import { z } from "zod";

// Define the form schema with zod
const updatePriorityFormSchema = z.object({
  priority: z.enum(ticketPriorityEnumArray, {
    required_error: "Please select a status",
  }),
  description: z
    .string({
      required_error: "Please provide a description for priority change",
    })
    .max(200, {
      message: "Description must be less than 200 characters",
    }),
});

// Define the form values type
type UpdatePriorityFormValues = z.infer<typeof updatePriorityFormSchema>;

export function useUpdatePriorityModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [ticketId, setTicketId] = useState<string>("");
  const [ticketTitle, setTicketTitle] = useState<string>("");
  const [originalPriority, setOriginalPriority] = useState<string>("");
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Initialize form with React Hook Form
  const form = useForm<UpdatePriorityFormValues>({
    resolver: zodResolver(updatePriorityFormSchema),
    defaultValues: {
      priority: undefined,
      description: t("tktH.upgrade", { priority: t("normal") }),
    },
  });

  // Setup mutation for updating the ticket status
  const updatePriorityMutation = useMutation({
    mutationFn: updateTicketPriority,
    onSuccess: (data) => {
      toast({
        title: t("success"),
        description: data.message || t("priority_updated"),
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
  const onSubmit = (values: UpdatePriorityFormValues) => {
    updatePriorityMutation.mutate({
      ticketId,
      priority: values.priority,
      description: values.description,
    });
  };

  // Function to open the update status modal
  function openUpdatePriorityModal(
    ticketId: string,
    ticketTitle: string,
    currentPriority: string,
  ) {
    setTrue();
    setTicketId(ticketId);
    setTicketTitle(ticketTitle);
    setOriginalPriority(currentPriority);
    const description = t("tktH.upgrade", {
      originalPriority: t(currentPriority),
      priority: t(currentPriority),
    });
    form.reset({
      priority: currentPriority as any,
      description,
    });
  }

  // Handle priority selection
  const handlePrioritySelect = (
    priority: (typeof ticketPriorityEnumArray)[number],
  ) => {
    const newDescription = t("tktH.upgrade", {
      priority: t(priority),
    });
    form.setValue("priority", priority);
    form.setValue("description", newDescription);
  };

  const currentPriority = form.watch("priority");
  const isPriorityChanged = currentPriority !== originalPriority;

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="sm:max-w-[348px] p-6 gap-2 !rounded-2xl">
        <DialogHeader className="flex gap-4">
          <DialogTitle className="text-lg font-semibold text-zinc-900 leading-none">
            {t("set_prty")}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-zinc-900 leading-5">
            {t("set_prty_desc", { title: ticketTitle })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem className="flex">
                  <FormControl>
                    <div className="flex flex-col gap-2 w-full">
                      {ticketPriorityEnumArray
                        .filter((priority) => priority !== "normal")
                        .map((priority) => {
                          const isSelected = field.value === priority;
                          return (
                            <div
                              key={priority}
                              className={cn(
                                "flex h-11 items-center  pl-3 pr-2 justify-between rounded-lg border cursor-pointer transition-all self-stretch",
                                isSelected
                                  ? "border-zinc-200 bg-blue-50"
                                  : "border-zinc-200 hover:bg-zinc-50",
                              )}
                              onClick={() => handlePrioritySelect(priority)}
                            >
                              <div className="flex items-center gap-2">
                                <PriorityBadge
                                  priority={priority}
                                  textSize="text-[12px]"
                                  textSize2="text-[8px]"
                                  height="h-[20px]"
                                  width="w-[37px]"
                                  width2="w-[35px]"
                                />
                                <span className="text-xs font-normal text-zinc-500 leading-4">
                                  {t(priority)}
                                </span>
                              </div>
                              {isSelected && (
                                <CheckIcon
                                  className="h-4 w-4 text-blue"
                                  strokeWidth={1.33}
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <div className="flex flex-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={setFalse}
                  disabled={updatePriorityMutation.isPending}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !form.formState.isValid ||
                    updatePriorityMutation.isPending ||
                    !isPriorityChanged
                  }
                >
                  {updatePriorityMutation.isPending
                    ? t("updating")
                    : t("confirm")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openUpdatePriorityModal,
    closeUpdatePriorityModal: setFalse,
    updatePriorityModal: modal,
    isUpdatingPriority: updatePriorityMutation.isPending,
  };
}
