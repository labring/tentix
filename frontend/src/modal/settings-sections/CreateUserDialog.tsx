import { useState } from "react";
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
import { JsonRecordEditor } from "../../components/common/JsonRecordEditor";

// Form validation schema - matches backend createUserSchema
const createUserFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "用户名不能为空")
    .min(3, "用户名至少3个字符")
    .max(50, "用户名不能超过50个字符")
    .regex(
      /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      "用户名只能包含字母、数字、下划线和中文字符",
    ),
  password: z
    .string()
    .min(6, "密码至少6个字符")
    .max(100, "密码不能超过100个字符"),
  realName: z
    .string()
    .trim()
    .max(50, "真实姓名不能超过50个字符")
    .optional(),
  phoneNum: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
    .optional()
    .or(z.literal("")),
  nickname: z
    .string()
    .trim()
    .max(30, "昵称不能超过30个字符")
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
    .email("请输入有效的邮箱地址")
    .optional()
    .or(z.literal("")),
  meta: z.record(z.any()).default({}),
});

// Use z.output to get the actual output type after defaults are applied
type CreateUserFormData = z.output<typeof createUserFormSchema>;

interface CreateUserDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateUserDialog({
  children,
  onSuccess,
}: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.input<typeof createUserFormSchema>, unknown, CreateUserFormData>({
    resolver: zodResolver(createUserFormSchema),
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
        throw new Error(err.message || "创建用户失败");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "用户创建成功",
        variant: "default",
      });
      form.reset();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "创建用户失败",
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
          <DialogTitle>创建新用户</DialogTitle>
          <DialogDescription>
            创建新的用户账号。标有 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup>
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                基本信息
              </h3>

              {/* 用户名 - 必填 */}
              <Field>
                <FieldLabel>
                  <span className="text-destructive">*</span> 用户名
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder="输入用户名"
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
                  <span className="text-destructive">*</span> 密码
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        type="password"
                        placeholder="输入密码（至少6位字符）"
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 角色 */}
              <Field>
                <FieldLabel>角色</FieldLabel>
                <Controller
                  control={form.control}
                  name="role"
                  render={({ field, fieldState }) => (
                    <>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择用户角色" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">客户</SelectItem>
                          <SelectItem value="agent">客服</SelectItem>
                          <SelectItem value="technician">技术员</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
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
                详细信息
              </h3>

              {/* 真实姓名 */}
              <Field>
                <FieldLabel>真实姓名</FieldLabel>
                <Controller
                  control={form.control}
                  name="realName"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder="输入真实姓名"
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 昵称 */}
              <Field>
                <FieldLabel>昵称</FieldLabel>
                <Controller
                  control={form.control}
                  name="nickname"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder="输入昵称"
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 邮箱 */}
              <Field>
                <FieldLabel>邮箱</FieldLabel>
                <Controller
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        type="email"
                        placeholder="输入邮箱地址"
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 电话号码 */}
              <Field>
                <FieldLabel>电话号码</FieldLabel>
                <Controller
                  control={form.control}
                  name="phoneNum"
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        placeholder="输入电话号码"
                        {...field}
                      />
                      <FieldError errors={fieldState.error ? [fieldState.error] : []} />
                    </>
                  )}
                />
              </Field>

              {/* 级别 */}
              <Field>
                <FieldLabel>级别</FieldLabel>
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
                  label="Meta 数据"
                  description="添加键值对来配置额外的用户数据"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error}
                  placeholder='输入 JSON 格式的数据，例如：
{
  "department": "技术部",
  "customField": "自定义值"
}'
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
              取消
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "创建中..." : "创建用户"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}