import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "tentix-ui"

import { Button } from "tentix-ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "tentix-ui"
import { RadioGroup, RadioGroupItem } from "tentix-ui"
import { Textarea } from "tentix-ui"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "tentix-ui"

import { useBoolean } from "ahooks"
import { updateTicketStatus } from "@lib/query"
import { Label } from "tentix-ui"
import { ticketStatusEnumArray } from "tentix-server/constants"

// Define the form schema with zod
const updateStatusFormSchema = z.object({
  status: z.enum(ticketStatusEnumArray, {
    required_error: "Please select a status",
  }),
  reason: z.string({
    required_error: "Please provide a reason for status change",
  }).min(3, {
    message: "Reason must be at least 3 characters",
  }),
})

// Define the form values type
type UpdateStatusFormValues = z.infer<typeof updateStatusFormSchema>

export function useUpdateStatusModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false)
  const [ticketId, setTicketId] = useState<string>("")

  // Initialize form with React Hook Form
  const form = useForm<UpdateStatusFormValues>({
    resolver: zodResolver(updateStatusFormSchema),
    defaultValues: {
      status: undefined,
      reason: "",
    },
  })

  // Setup mutation for updating the ticket status
  const updateStatusMutation = useMutation({
    mutationFn: updateTicketStatus,
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Ticket status updated successfully",
        variant: "default",
      });
      setFalse();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update ticket status",
        variant: "destructive",
      });
    },
  })

  // Handle form submission
  const onSubmit = (values: UpdateStatusFormValues) => {
    updateStatusMutation.mutate({
      ticketId,
      status: values.status,
      description: values.reason,
    });
  }

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
          <DialogTitle>Update Ticket Status</DialogTitle>
          <DialogDescription>
            Change the status of ticket #{ticketId}. This will notify all members of the ticket.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Select Status</FormLabel>
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
                              {status}
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
                  <FormLabel>Reason for Status Change</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why are you changing the status of this ticket?"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide a brief explanation for the status change
                  </FormDescription>
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )

  return {
    state,
    openUpdateStatusModal,
    closeUpdateStatusModal: setFalse,
    updateStatusModal: modal,
    isUpdatingStatus: updateStatusMutation.isPending,
  }
} 