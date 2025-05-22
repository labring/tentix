import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "tentix-ui"
import { useTranslation } from "i18n"

import { Button } from "tentix-ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "tentix-ui"
import { Textarea } from "tentix-ui"
import { Input } from "tentix-ui"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "tentix-ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "tentix-ui"

import { useBoolean } from "ahooks"
import { raiseRequirement } from "@lib/query"
import { moduleEnumArray, ticketPriorityEnumArray } from "tentix-server/constants"

// Define the form schema with zod
const raiseReqFormSchema = z.object({
  title: z.string({
    required_error: "Title is required",
  }).min(3, {
    message: "Title must be at least 3 characters",
  }),
  description: z.string({
    required_error: "Description is required",
  }).min(10, {
    message: "Description must be at least 10 characters",
  }),
  module: z.enum(moduleEnumArray, {
    required_error: "Please select a module",
  }),
  priority: z.enum(ticketPriorityEnumArray, {
    required_error: "Please select a priority",
  }),
})

// Define the form values type
type RaiseReqFormValues = z.infer<typeof raiseReqFormSchema>

export function useRaiseReqModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false)
  const [relatedTicketId, setRelatedTicketId] = useState<string | undefined>(undefined)
  const { t } = useTranslation()

  // Initialize form with React Hook Form
  const form = useForm<RaiseReqFormValues>({
    resolver: zodResolver(raiseReqFormSchema),
    defaultValues: {
      title: "",
      description: "",
      module: undefined,
      priority: "normal",
    },
  })

  // Setup mutation for raising a requirement
  const raiseReqMutation = useMutation({
    mutationFn: raiseRequirement,
    onSuccess: (data) => {
      toast({
        title: t("success"),
        description: data.message || t("req_raised"),
        variant: "default",
      });
      setFalse();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_raise_req"),
        variant: "destructive",
      });
    },
  })

  // Handle form submission
  const onSubmit = (values: RaiseReqFormValues) => {
    if (relatedTicketId) {
      raiseReqMutation.mutate({
        ...values,
        relatedTicket: relatedTicketId,
      });
    } else {
      toast({
        title: t("error"),
        variant: "destructive",
      });
    }
  }

  // Function to open the raise requirement modal
  function openRaiseReqModal(relatedTicketId?: string) {
    setTrue();
    setRelatedTicketId(relatedTicketId);
    form.reset({
      title: "",
      description: "",
      module: undefined,
      priority: "normal",
    });
  }

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{t("raise_req_title")}</DialogTitle>
          <DialogDescription>
            {relatedTicketId 
              ? t("raise_req_desc_linked", { id: relatedTicketId })
              : t("raise_req_desc_general")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("req_title")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("req_title_ph")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="module"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("module")}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("select")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {moduleEnumArray.map((module) => (
                          <SelectItem key={module} value={module}>
                            {t(module)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("priority")}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("select")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ticketPriorityEnumArray.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {t(priority)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("req_description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("req_desc_ph")}
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("req_desc_help")}
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
                disabled={raiseReqMutation.isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isValid || raiseReqMutation.isPending}
              >
                {raiseReqMutation.isPending ? t("submitting") : t("raise_req_btn")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )

  return {
    state,
    openRaiseReqModal,
    closeRaiseReqModal: setFalse,
    raiseReqModal: modal,
    isRaisingReq: raiseReqMutation.isPending,
  }
}