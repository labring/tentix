import { zodResolver } from "@hookform/resolvers/zod";
import { staffListQueryOptions, useSuspenseQuery } from "@lib/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoolean } from "ahooks";
import { useTranslation } from "i18n";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Checkbox,
  Textarea,
  toast,
  Badge,
} from "tentix-ui";
import { z } from "zod";
import useLocalUser from "@hook/use-local-user";
import { apiClient } from "@lib/api-client";

// Define the form schema with zod
const transferFormSchema = z.object({
  staffIds: z.array(z.string()).min(1, {
    message: "Please select at least one staff member",
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
  targetStaffId: number[];
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
  const queryClient = useQueryClient();

  // Get staff list from API
  const { data: staffList } = useSuspenseQuery(staffListQueryOptions());

  // Initialize form with React Hook Form
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      staffIds: [],
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
      // Invalidate all ticket-related queries to refresh data
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
        description: error.message || t("failed_transfer"),
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: TransferFormValues) => {
    // console.log(values);
    transferMutation.mutate({
      ticketId,
      targetStaffId: values.staffIds.map((id) => parseInt(id)),
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
      <DialogContent className="flex flex-col gap-4 w-[31.25rem] max-w-[31.25rem] !rounded-2xl p-6 shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.10),0px_4px_6px_-2px_rgba(0,0,0,0.05)] border-0">
        <div className="flex flex-col items-start gap-[6px]">
          <p className="text-lg font-semibold leading-none text-foreground font-sans">
            Transfer Ticket
          </p>
          <p className="text-sm font-normal leading-5 text-zinc-500 font-sans">
            Transfer this ticket to another employee, and they will be notified
            about the transfer.
          </p>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="staffIds"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-medium text-zinc-900 font-sans leading-5 normal-case">
                    Select Employee
                  </FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-2">
                      <Input
                        placeholder="Search employee"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10"
                      />
                      <>
                        <style
                          dangerouslySetInnerHTML={{
                            __html: `
                            .staff-list-scrollbar::-webkit-scrollbar {
                              width: 12px;
                            }
                            .staff-list-scrollbar::-webkit-scrollbar-track {
                              background: #FAFAFA;
                              border-radius: 8px;
                              margin: 0;
                            }
                            .staff-list-scrollbar::-webkit-scrollbar-thumb {
                              background: #E4E4E7;
                              border-radius: 999px;
                              border: 2px solid #FAFAFA;
                              background-clip: content-box;
                            }
                        `,
                          }}
                        />
                        <div className="flex flex-col min-h-0 max-h-72 overflow-y-auto border rounded-lg staff-list-scrollbar">
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
                            .map((staff, index, array) => (
                              <div
                                key={staff.id}
                                className={`flex items-center px-5 gap-2 h-12 cursor-pointer hover:bg-blue-50 transition-all duration-200 ${
                                  index !== array.length - 1 ? "border-b" : ""
                                }`}
                              >
                                <Checkbox
                                  checked={
                                    Array.isArray(field.value) &&
                                    field.value.includes(staff.id.toString())
                                  }
                                  onCheckedChange={(checked) => {
                                    const currentValues = Array.isArray(
                                      field.value,
                                    )
                                      ? field.value
                                      : [];
                                    const staffIdStr = staff.id.toString();

                                    if (checked) {
                                      if (!currentValues.includes(staffIdStr)) {
                                        field.onChange([
                                          ...currentValues,
                                          staffIdStr,
                                        ]);
                                      }
                                    } else {
                                      field.onChange(
                                        currentValues.filter(
                                          (id) => id !== staffIdStr,
                                        ),
                                      );
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`staff-${staff.id}`}
                                  className="flex flex-1 cursor-pointer items-center gap-2"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const currentValues = Array.isArray(
                                      field.value,
                                    )
                                      ? field.value
                                      : [];
                                    const staffIdStr = staff.id.toString();
                                    const isSelected =
                                      currentValues.includes(staffIdStr);

                                    if (isSelected) {
                                      field.onChange(
                                        currentValues.filter(
                                          (id) => id !== staffIdStr,
                                        ),
                                      );
                                    } else {
                                      field.onChange([
                                        ...currentValues,
                                        staffIdStr,
                                      ]);
                                    }
                                  }}
                                >
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage
                                      src={staff.avatar || "/placeholder.svg"}
                                      alt={staff.name}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {staff.name.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="truncate text-sm font-medium leading-5 text-foreground font-sans">
                                      {staff.name}
                                    </div>
                                  </div>
                                  <Badge
                                    className={`
                                      flex h-5 px-1.5 py-0.5 justify-center items-center gap-2.5 rounded-full shrink-0
                                      text-zinc-900 font-sans font-medium leading-[140%] border-[0.5px] normal-case
                                      ${
                                        staff.ticketNum < 10
                                          ? "border-emerald-200 bg-emerald-50"
                                          : staff.ticketNum >= 10 &&
                                              staff.ticketNum < 20
                                            ? "border-orange-200 bg-orange-50"
                                            : "border-red-200 bg-red-50"
                                      }
                                    `}
                                    style={{
                                      fontSize: "12.8px",
                                    }}
                                  >
                                    {staff.ticketNum} tickets
                                  </Badge>
                                </Label>
                              </div>
                            ))}
                        </div>
                      </>
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
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-medium text-zinc-900 font-sans leading-5 normal-case">
                    Reason for transfer
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide details for this transfer..."
                      {...field}
                      className="min-h-[6rem] resize-none border-gray-200 focus:border-primary"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <div className="flex flex-row gap-3 flex-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={setFalse}
                  disabled={transferMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !form.formState.isValid || transferMutation.isPending
                  }
                  className="flex-1"
                >
                  {transferMutation.isPending
                    ? "Transferring..."
                    : "Transfer Ticket"}
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
    openTransferModal,
    closeTransferModal: setFalse,
    transferModal: modal,
    isTransferring: transferMutation.isPending,
  };
}
