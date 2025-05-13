
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "../hooks/use-toast.ts";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../components/ui/avatar.tsx";
import { Button } from "../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.tsx";
import { Label } from "../components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group.tsx";
import { Textarea } from "../components/ui/textarea.tsx";
import { Input } from "../components/ui/input.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form.tsx";
import { useBoolean } from "ahooks";
import { staffListQueryOptions } from "../lib/query.ts";
import { useSuspenseQuery } from "../lib/query.ts";
import { apiClient } from "../lib/utils.ts";
import useLocalUser from "../hooks/use-local-user.tsx";

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
  ticketId: number;
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
  const [ticketId, setTicketId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const user = useLocalUser();

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
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Ticket transferred successfully",
        variant: "default",
      });
      setFalse();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to transfer ticket",
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
  function openTransferModal(ticketId: number) {
    setTrue();
    setTicketId(ticketId);
    form.reset();
  }



  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Transfer Ticket #{ticketId}</DialogTitle>
          <DialogDescription>
            Transfer this ticket to another staff member. The current assignee
            will be notified.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Select Staff Member</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder="Search staff members..."
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
                              className={`flex items-center space-x-2 rounded-md border p-3 ${
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
                                  {staff.workload} Workload
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
                  <FormLabel>Transfer Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why are you transferring this ticket?"
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || transferMutation.isPending}
              >
                {transferMutation.isPending
                  ? "Transferring..."
                  : "Transfer Ticket"}
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
