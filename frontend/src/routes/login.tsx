import {
  createFileRoute,
  useRouter,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ApiErrorResponse } from "tentix-server/types";
import { z } from "zod";
import { useTranslation } from "i18n";
import { useAuth } from "../hooks/use-local-user";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from "tentix-ui";

type LoginFormData = { name: string; password: string };
type ResetPasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const Route = createFileRoute("/login")({
  component: LoginComponent,
});

function LoginComponent() {
  const { t } = useTranslation();
  const router = useRouter();
  const routeContext = useRouteContext({ from: "/login" });
  const authContext = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetUserData, setResetUserData] = useState<{
    id: number;
    name: string;
    role: string;
  } | null>(null);

  const schema = z.object({
    name: z.string().min(1, t("name_required")),
    password: z.string().min(6, t("password_min_6")),
  });

  const resetSchema = z
    .object({
      currentPassword: z.string().min(6, t("password_min_6")),
      newPassword: z.string().min(6, t("password_min_6")),
      confirmPassword: z.string().min(6, t("password_min_6")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("password_not_match"),
      path: ["confirmPassword"],
    });

  const form = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // 统一的认证成功处理
  const handleAuthSuccess = async (authData: {
    id: number;
    role: string;
    token: string;
  }) => {
    // 保存认证信息
    localStorage.setItem("role", authData.role);
    localStorage.setItem("id", authData.id.toString());
    localStorage.setItem("token", authData.token);

    // 获取用户信息并更新上下文
    const userData = await routeContext.apiClient.user.info
      .$get()
      .then((r) => r.json());
    authContext.updateUser(userData);
    authContext.setIsAuthenticated(true);

    // 根据角色跳转
    const isStaff = ["technician", "agent", "admin"].includes(authData.role);
    router.navigate({
      to: isStaff ? "/staff/tickets/list" : "/user/tickets/list",
      replace: true,
    });
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const apiClient = routeContext.apiClient;
      const res = await (
        await apiClient.auth.login.$post({
          json: {
            name: data.name,
            password: data.password,
          },
        })
      ).json();
      // 检查管理员用户是否需要重置密码
      if ("needReset" in res && res.needReset) {
        setResetUserData({
          id: res.id,
          name: res.name,
          role: res.role,
        });
        setIsResetMode(true);
        form.reset();
        return;
      }

      // 正常登录成功
      if (!("token" in res)) {
        throw new Error("Invalid login response");
      }

      await handleAuthSuccess(res);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      if (err?.code === 404) {
        // 用户不存在，自动切换到注册模式
        setIsRegisterMode(true);
        toast({
          title: t("user_not_found"),
          description: t("please_register_first"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("login_failed"),
          description: err?.message || t("invalid_credentials"),
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const apiClient = routeContext.apiClient;
      const res = await apiClient.auth.register
        .$post({ json: { name: data.name, password: data.password } })
        .then((r) => r.json());

      await handleAuthSuccess(res);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast({
        title: t("registration_failed"),
        description: err?.message || t("registration_failed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async (data: ResetPasswordFormData) => {
    if (!resetUserData) return;

    setIsLoading(true);
    try {
      const apiClient = routeContext.apiClient;
      const res = await apiClient.auth["reset-password"]
        .$post({
          json: {
            id: resetUserData.id,
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          },
        })
        .then((r) => r.json());

      toast({
        title: t("password_reset_success"),
        description: t("password_reset_success_desc"),
      });

      await handleAuthSuccess(res);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast({
        title: t("password_reset_failed"),
        description: err?.message || t("password_reset_failed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {isResetMode
              ? t("reset_password_title")
              : isRegisterMode
                ? t("register_title")
                : t("login_title")}
          </CardTitle>
          <CardDescription>
            {isResetMode
              ? t("reset_password_subtitle")
              : isRegisterMode
                ? t("register_subtitle")
                : t("login_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isResetMode ? (
            <Form {...resetForm} key="reset-form">
              <form
                onSubmit={resetForm.handleSubmit(onResetPassword)}
                className="space-y-4"
              >
                <div className="text-sm text-muted-foreground mb-4">
                  {t("reset_password_for_user", { name: resetUserData?.name })}
                </div>
                <FormField
                  control={resetForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("field_current_password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("ph_current_password")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("field_new_password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("ph_new_password")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("field_confirm_password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("ph_confirm_password")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("loading") : t("btn_reset_password")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsResetMode(false);
                      setResetUserData(null);
                      resetForm.reset();
                    }}
                    disabled={isLoading}
                  >
                    {t("btn_back_to_login")}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form
              {...form}
              key={isRegisterMode ? "register-form" : "login-form"}
            >
              <form
                onSubmit={form.handleSubmit(
                  isRegisterMode ? onRegister : onSubmit,
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("field_name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("ph_name")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("field_password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("ph_password")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? t("loading")
                      : isRegisterMode
                        ? t("btn_register")
                        : t("btn_login")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode);
                      form.reset(); // 切换模式时重置表单
                    }}
                    disabled={isLoading}
                  >
                    {isRegisterMode
                      ? t("btn_switch_to_login")
                      : t("btn_switch_to_register")}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
