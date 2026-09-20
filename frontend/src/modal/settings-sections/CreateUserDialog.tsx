import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Input,
  useToast,
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "tentix-ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@lib/api-client";
import { userRoleEnumArray } from "tentix-server/constants";
import { type TFunction, useTranslation } from "i18n";
import { JsonRecordEditor } from "../../components/common/JsonRecordEditor";

// Form validation schema - matches backend createUserSchema
const createUserFormSchema = (t: TFunction) =>
  z.object({
  name: z
    .string()
    .trim()
    .min(1, t("username_required"))
    .min(3, t("username_min"))
    .max(50, t("username_max"))
    .regex(
      /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      t("username_pattern"),
    ),
  password: z
    .string()
    .min(6, t("password_min"))
    .max(100, t("password_max")),
  realName: z
    .string()
    .trim()
    .max(50, t("real_name_max"))
    .optional(),
  phoneNum: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, t("phone_invalid"))
    .optional()
    .or(z.literal("")),
  nickname: z
    .string()
    .trim()
    .max(30, t("nickname_max"))
    .optional(),
  role: z
    .enum(userRoleEnumArray)
    .refine((v) => v !== "system", {
      message: "system role is not assignable",
    })
    .default("customer"),
  level: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(1),
  email: z
    .string()
    .trim()
    .email(t("email_invalid"))
    .optional()
    .or(z.literal("")),
  meta: z.record(z.any()).default({}),
});

// Use z.output to get the actual output type after defaults are applied
type CreateUserFormData = z.output<ReturnType<typeof createUserFormSchema>>;

interface CreateUserDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateUserDialog({
  children,
  onSuccess,
}: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const schema = useMemo(() => createUserFormSchema(t), [t]);
  const form = useForm<z.input<typeof schema>, unknown, CreateUserFormData>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      password: "",
      realName: "",
      phoneNum: "",
      nickname: "",
      role: "customer",
      level: 1,
      email: "",
      meta: {},
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const res = await apiClient.admin["create-user"].$post({
        json: data,
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || t("failed_create_user"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: t("user_create_success"),
        variant: "default",
      });
      form.reset();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: t("failed_create_user"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  const isLoading = createUserMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("user_create_dialog_title")}</DialogTitle>
          <DialogDescription>
            {t("user_create_dialog_description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup>
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("basic_info")}
              </h3>

              {/* 用户名 - 必填 */}
              <Field>
                <FieldLabel>
                  <span className="text-destructive">*</span> {t("username")}
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder={t("user_create_name_placeholder")}
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 密码 - 必填 */}
              <Field>
                <FieldLabel>
                  <span className="text-destructive">*</span> {t("field_password")}
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        type="password"
                        placeholder={t("user_create_password_placeholder")}
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 角色 */}
              <Field>
                <FieldLabel>{t("role")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="role"
                  render={({ field, fieldState }) => (
                    <>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("user_create_role_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">{t("user_role_customer")}</SelectItem>
                          <SelectItem value="agent">{t("user_role_agent")}</SelectItem>
                          <SelectItem value="technician">{t("user_role_technician")}</SelectItem>
                          <SelectItem value="admin">{t("user_role_admin")}</SelectItem>
                          <SelectItem value="ai">AI</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>
            </div>

            {/* 详细信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("user_create_section_details")}
              </h3>

              {/* 真实姓名 */}
              <Field>
                <FieldLabel>{t("real_name")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="realName"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder={t("user_create_real_name_placeholder")}
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 昵称 */}
              <Field>
                <FieldLabel>{t("user_nickname")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="nickname"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder={t("user_create_nickname_placeholder")}
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 邮箱 */}
              <Field>
                <FieldLabel>{t("email")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        type="email"
                        placeholder={t("user_create_email_placeholder")}
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 电话号码 */}
              <Field>
                <FieldLabel>{t("user_create_phone_label")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="phoneNum"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder={t("user_create_phone_placeholder")}
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 级别 */}
              <Field>
                <FieldLabel>{t("user_level")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="level"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="1"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>
            </div>

            {/* Meta 字段 */}
            <Controller
              control={form.control}
              name="meta"
              render={({ field, fieldState }) => (
                <JsonRecordEditor
                  label={t("user_create_meta_label")}
                  description={t("user_create_meta_description")}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error}
                  placeholder={t("user_create_meta_placeholder")}
                />
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t("user_creating") : t("user_create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}