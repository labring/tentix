import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
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
import { useTicketModules } from "@store/app-config";
import { processFilesAndUpload } from "@comp/chat/upload-utils";
import { isLocalFileNode } from "@comp/chat/utils";
import { useWorkflowTestChatStore } from "@store/workflow-test-chat";

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

interface NewTestTicketProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function NewTestTicket({
  onSuccess,
  onCancel,
}: NewTestTicketProps = {}) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { currentWorkflowId } = useWorkflowTestChatStore();
  const ticketModules = useTicketModules();

  // Get current language (zh or en)
  const currentLang = i18n.language === "zh" ? "zh-CN" : "en-US";

  const ticketFormSchema = z.object({
    title: z
      .string()
      .min(1, t("field_required"))
      .min(3, t("title_min_length") || "Title must be at least 3 characters"),
    module: z
      .string()
      .min(1, t("please_select_module") || "Please select a module"),
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
      if (!currentWorkflowId) {
        throw new Error("no workflow Id");
      }

      const serverData: testTicketInsertType = {
        title: data.title,
        module: data.module,
        description: data.description,
        workflowId: currentWorkflowId,
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
        queryKey: ["testTickets"],
      });
      toast({ title: t("ticket_created"), variant: "default" });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("ticket_create_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

      if (formData.description && hasFilesToUpload(formData.description)) {
        try {
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
    <div className="space-y-4">
      {/* Upload progress indicator */}
      {uploadProgress && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">
            {t("uploading_files", {
              uploaded: uploadProgress.uploaded,
              total: uploadProgress.total,
            })}
            {uploadProgress.currentFile && ` - ${uploadProgress.currentFile}`}
          </div>
          <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${(uploadProgress.uploaded / uploadProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <form id="ticket-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Description text */}
        <p className="text-sm text-muted-foreground">{t("plz_pvd_info")}</p>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title-input">
            <span className="text-destructive">*</span> {t("title")}
          </Label>
          <Input
            id="title-input"
            {...register("title")}
            placeholder={t("title_ph")}
            className={errors.title ? "border-destructive" : ""}
          />
          {errors.title && (
            <p className="text-sm text-destructive">
              {getErrorMessage(errors.title, t("field_required"))}
            </p>
          )}
        </div>

        {/* Module */}
        <div className="space-y-2">
          <Label htmlFor="module">
            <span className="text-destructive">*</span> {t("module")}
          </Label>
          <Controller
            control={control}
            name="module"
            render={({ field }) => (
              <Select {...field} onValueChange={field.onChange}>
                <SelectTrigger
                  id="module"
                  className={errors.module ? "border-destructive" : ""}
                >
                  <SelectValue
                    placeholder={joinTrans([t("select"), t("module")])}
                  />
                </SelectTrigger>
                <SelectContent>
                  {ticketModules.map((module) => (
                    <SelectItem key={module.code} value={module.code}>
                      {module.translations[currentLang] || module.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.module && (
            <p className="text-sm text-destructive">
              {getErrorMessage(errors.module, t("field_required"))}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">
            <span className="text-destructive">*</span> {t("desc")}
          </Label>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <DescriptionEditor
                {...field}
                value={field.value}
                onChange={(v) => field.onChange(v as JSONContentZod)}
                editorContentClassName="min-h-[200px] max-h-[300px] overflow-auto"
                placeholder={t("desc_ph")}
                output="json"
                autofocus
                editable
                editorClassName="focus:outline-none px-3 py-2"
                className="border rounded-lg"
              />
            )}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isLoading || !currentWorkflowId}>
            {uploadProgress
              ? `${Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}%`
              : isLoading
                ? "..."
                : t("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
