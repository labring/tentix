import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
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
import type { ticketInsertType, JSONContentZod } from "tentix-server/types";
import {
  ticketPriorityEnumArray,
  moduleEnumArray,
  areaEnumArray,
} from "tentix-server/constants";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import { processFilesAndUpload } from "@comp/chat/upload-utils";
import { useSealos } from "src/_provider/sealos";

// Client-side validation schema - 只验证用户需要填写的字段
const createTicketFormSchema = (t: (key: string) => string) =>
  z.object({
    title: z
      .string()
      .min(1, t("field_required"))
      .min(3, t("title_min_length") || "Title must be at least 3 characters"),
    module: z.enum(moduleEnumArray, {
      required_error: t("please_select_module") || "Please select a module",
    }),
    description: z.any(),
    area: z.enum(areaEnumArray).optional(),
    occurrenceTime: z.string().optional(),
    priority: z.enum(ticketPriorityEnumArray).optional(),
  });

type TicketFormData = z.infer<ReturnType<typeof createTicketFormSchema>>;

// Helper function to safely get error message
const getErrorMessage = (error: any, fallback: string): string => {
  if (typeof error?.message === "string") {
    return error.message;
  }
  return fallback;
};

// Ticket Form Component (only used in this page)
function TicketForm({
  register,
  control,
  errors,
}: {
  register: ReturnType<typeof useForm<TicketFormData>>["register"];
  control: ReturnType<typeof useForm<TicketFormData>>["control"];
  errors: ReturnType<typeof useForm<TicketFormData>>["formState"]["errors"];
}) {
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="w-230 p-8  bg-white rounded-2xl border border-zinc-200">
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
                    {moduleEnumArray.map((m) => (
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
    </div>
  );
}

// 上传进度接口
interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

// Custom hook for ticket creation logic
function useTicketCreation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sealosArea } = useSealos();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );

  // Create schema with translation
  const ticketFormSchema = createTicketFormSchema(t);

  // Form management
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      area: sealosArea as (typeof areaEnumArray)[number],
      priority: ticketPriorityEnumArray[0],
      occurrenceTime: new Date().toISOString(),
    },
  });

  // API mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      // Transform form data to match server schema
      const serverData: ticketInsertType = {
        title: data.title,
        module: data.module,
        description: data.description,
        area: data.area || (sealosArea as (typeof areaEnumArray)[number]) || "hzh",
        occurrenceTime: data.occurrenceTime || new Date().toISOString(),
        priority: data.priority || ticketPriorityEnumArray[0],
      };

      const res = await apiClient.ticket.create.$post({ json: serverData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.status || t("ticket_create_failed"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["getUserTickets"],
      });
      toast({ title: t("ticket_created"), variant: "default" });
      navigate({ to: "/user/tickets/$id", params: { id: data.id.toString() } });
    },
    onError: (error: Error) => {
      toast({
        title: t("ticket_create_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 检查内容节点是否为本地文件
  const isLocalFileNode = (node: any): boolean => {
    return node.type === "image" && node.attrs?.isLocalFile;
  };

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
          console.error("文件上传失败:", uploadError);

          toast({
            title: "文件上传失败",
            description:
              uploadError instanceof Error
                ? uploadError.message
                : "文件上传时出现错误",
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
      console.error("提交工单失败:", error);

      toast({
        title: t("ticket_create_failed"),
        description:
          error instanceof Error ? error.message : "提交时出现未知错误",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    form,
    submitTicket,
    isLoading: createTicketMutation.isPending || uploadProgress !== null,
    uploadProgress,
  };
}

export const Route = createFileRoute("/user/newticket/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);

  // Ticket creation logic
  const { form, submitTicket, isLoading, uploadProgress } = useTicketCreation();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  // Event handlers
  const handleBackClick = () => {
    try {
      router.history.back();
    } catch (error) {
      console.warn(
        "History navigation failed, falling back to default route:",
        error,
      );
      navigate({ to: "/user/tickets/list" });
    }
  };

  const handleSubmitClick = () => {
    setShowDialog(true);
  };

  const handleDialogConfirm = async () => {
    const success = await submitTicket();
    if (success) {
      setShowDialog(false);
    }
    // if validation failed, the dialog will stay open and show the error message
  };

  const handleDialogCancel = () => {
    setShowDialog(false);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-24 items-center border-b px-10 justify-between bg-white">
        <div className="flex items-center gap-3">
          <ArrowLeftIcon
            className="h-6 w-6 cursor-pointer"
            onClick={handleBackClick}
          />
          <p className="text-black text-2xl font-semibold leading-8">
            {t("create_new_ticket")}
          </p>
        </div>
        <Button
          className="w-30 items-center justify-center rounded-lg cursor-pointer"
          onClick={handleSubmitClick}
          type="button"
          disabled={isLoading}
        >
          {isLoading ? t("submitting") : t("submit")}
        </Button>
      </header>
      <div className="@container/main flex flex-1 flex-col justify-center items-center">
        {/* Ticket Form */}
        <TicketForm register={register} control={control} errors={errors} />
      </div>
      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-96 p-6 !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <TriangleAlertIcon className="!h-4 !w-4 text-yellow-600" />
              {t("prompt")}
            </DialogTitle>
            <DialogDescription>
              {uploadProgress ? (
                <div className="space-y-2">
                  <div>{t("are_you_sure_submit_ticket")}</div>
                  <div className="text-sm text-zinc-600">
                    正在上传文件 {uploadProgress.uploaded}/
                    {uploadProgress.total}
                    {uploadProgress.currentFile &&
                      ` - ${uploadProgress.currentFile}`}
                  </div>
                </div>
              ) : (
                t("are_you_sure_submit_ticket")
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogCancel}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleDialogConfirm}
              className="w-20 h-10 px-4 py-2 bg-black"
              disabled={isLoading}
            >
              {uploadProgress
                ? `${Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}%`
                : isLoading
                  ? "..."
                  : t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
