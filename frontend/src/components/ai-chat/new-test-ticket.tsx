import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  useToast,
  Button,
  DescriptionEditor,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "tentix-ui";
import { useTranslation, joinTrans } from "i18n";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import type { testTicketInsertType, JSONContentZod } from "tentix-server/types";
import { moduleEnumArray } from "tentix-server/constants";
import { processFilesAndUpload } from "@comp/chat/upload-utils";
import { isLocalFileNode } from "@comp/chat/utils";

interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

const getErrorMessage = (error: any, fallback: string): string => {
  if (typeof error?.message === "string") {
    return error.message;
  }
  return fallback;
};

export function NewTestTicket() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const ticketFormSchema = z.object({
    title: z
      .string()
      .min(1, t("field_required"))
      .min(3, t("title_min_length") || "Title must be at least 3 characters"),
    module: z.enum(moduleEnumArray, {
      required_error: t("please_select_module") || "Please select a module",
    }),
    description: z.any(),
  });

  type TicketFormData = z.infer<typeof ticketFormSchema>;

  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      // Transform form data to match server schema
      const serverData: testTicketInsertType = {
        title: data.title,
        module: data.module,
        description: data.description,
      };

      const res = await apiClient.admin["test-ticket"].create.$post({
        json: serverData,
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || t("ticket_create_failed"));
      }

      return res.json();
    },
    onSuccess: (_) => {
      queryClient.invalidateQueries({
        queryKey: ["getTestTickets"],
      });
      toast({ title: t("ticket_created"), variant: "default" });
    },
    onError: (error: Error) => {
      toast({
        title: t("ticket_create_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 检查是否有需要上传的文件
  const hasFilesToUpload = (content: JSONContentZod): boolean => {
    let hasFiles = false;

    const traverse = (node: any): void => {
      if (isLocalFileNode(node)) {
        hasFiles = true;
        return;
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    content.content?.forEach(traverse);
    return hasFiles;
  };

  // Submit handlers
  const submitTicket = async () => {
    const isValid = await form.trigger();

    if (!isValid) {
      const errors = form.formState.errors;
      const errorMessages = Object.entries(errors)
        .map(
          ([field, error]) =>
            `${field}: ${getErrorMessage(error, t("field_required"))}`,
        )
        .join(", ");

      toast({
        title: t("plz_fill_all_fields"),
        description: errorMessages,
        variant: "destructive",
      });
      return false;
    }

    try {
      const formData = form.getValues();
      let processedDescription = formData.description;

      // 检查描述中是否有需要上传的文件
      if (formData.description && hasFilesToUpload(formData.description)) {
        try {
          // 处理文件上传
          const { processedContent } = await processFilesAndUpload(
            formData.description,
            (progress) => setUploadProgress(progress),
          );

          processedDescription = processedContent;
          setUploadProgress(null);
        } catch (uploadError) {
          setUploadProgress(null);
          console.error(`${t("file_upload_failed")}:`, uploadError);

          toast({
            title: t("file_upload_failed"),
            description:
              uploadError instanceof Error
                ? uploadError.message
                : t("file_upload_error"),
            variant: "destructive",
          });
          return false;
        }
      }

      // 使用处理后的描述内容
      const finalFormData = {
        ...formData,
        description: processedDescription,
      };

      createTicketMutation.mutate(finalFormData);
      return true;
    } catch (error) {
      setUploadProgress(null);
      console.error(`${t("ticket_create_failed")}:`, error);

      toast({
        title: t("ticket_create_failed"),
        description:
          error instanceof Error ? error.message : t("unknown_submit_error"),
        variant: "destructive",
      });
      return false;
    }
  };

  const {
    register,
    control,
    formState: { errors },
  } = form;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitTicket();
  };

  const isLoading = createTicketMutation.isPending || uploadProgress !== null;

  return (
    <div className="w-230 p-8  bg-white rounded-2xl border border-zinc-200">
      <DialogDescription>
        {uploadProgress ? (
          <div className="space-y-2">
            <div>{t("are_you_sure_submit_ticket")}</div>
            <div className="text-sm text-zinc-600">
              {t("uploading_files", {
                uploaded: uploadProgress.uploaded,
                total: uploadProgress.total,
              })}
              {uploadProgress.currentFile && ` - ${uploadProgress.currentFile}`}
            </div>
          </div>
        ) : (
          t("are_you_sure_submit_ticket")
        )}
      </DialogDescription>
      <form id="ticket-form" name="ticket-form" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5 items-center justify-center">
          <div className="flex flex-col gap-1 w-full">
            <p className="text-black text-xl font-medium leading-7 normal-case">
              {joinTrans([t("tkt"), t("info")])}
            </p>
            <p className="text-zinc-500 text-sm font-normal leading-5">
              {t("plz_pvd_info")}
            </p>
          </div>
          {/* form fields */}
          <div className="space-y-2 w-full">
            <Label htmlFor="title-input" className="normal-case">
              <span className="text-red-600">*</span>
              {t("title")}
            </Label>
            <Input
              id="title-input"
              {...register("title")}
              placeholder={t("title_ph")}
              className={
                errors.title
                  ? "border-red-500 focus:border-red-500 rounded-lg"
                  : "rounded-lg"
              }
            />
            {errors.title && (
              <p className="text-red-600 text-sm">
                {getErrorMessage(errors.title, t("field_required"))}
              </p>
            )}
          </div>

          {/* Module */}
          <div className="space-y-2 w-full">
            <Label htmlFor="module" className="normal-case">
              <span className="text-red-600">*</span>
              {t("module")}
            </Label>
            <Controller
              control={control}
              name="module"
              render={({ field }) => (
                <Select {...field} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="module"
                    className={
                      errors.module
                        ? "border-red-500 focus:border-red-500 rounded-lg"
                        : "rounded-lg"
                    }
                  >
                    <SelectValue
                      placeholder={joinTrans([t("select"), t("module")])}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleEnumArray
                      .filter((m) => m !== "all")
                      .map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(m)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.module && (
              <p className="text-red-600 text-sm">
                {getErrorMessage(errors.module, t("field_required"))}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2 w-full">
            <Label htmlFor="description" className="normal-case">
              <span className="text-red-600">*</span>
              {t("desc")}
            </Label>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <DescriptionEditor
                  {...field}
                  value={field.value}
                  onChange={(v) => field.onChange(v as JSONContentZod)}
                  editorContentClassName="overflow-auto h-full"
                  placeholder={t("desc_ph")}
                  output="json"
                  autofocus
                  editable
                  editorClassName="focus:outline-none h-full px-3 py-2"
                  className="border border-zinc-200 rounded-lg"
                />
              )}
            />
          </div>
        </div>
      </form>

      <Button variant="outline" onClick={() => {}}>
        {t("cancel")}
      </Button>
      <Button
        onClick={handleSubmit}
        className="w-20 h-10 px-4 py-2 bg-black"
        disabled={isLoading}
      >
        {uploadProgress
          ? `${Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}%`
          : isLoading
            ? "..."
            : t("submit")}
      </Button>
    </div>
  );
}
