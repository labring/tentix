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

  const schema = z.object({
    name: z.string().min(1, t("name_required")),
    password: z.string().min(6, t("password_min_6")),
  });

  const form = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

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

      window.localStorage.setItem("role", res.role);
      window.localStorage.setItem("id", res.id.toString());
      window.localStorage.setItem("token", res.token);

      const userData = await apiClient.user.info.$get().then((r) => r.json());

      authContext.updateUser(userData);
      authContext.setIsAuthenticated(true);

      const role = res.role;
      switch (role) {
        case "technician":
        case "agent":
          router.navigate({ to: "/staff/tickets/list", replace: true });
          break;
        default:
          router.navigate({ to: "/user/tickets/list", replace: true });
          break;
      }
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      if (err?.code === 404) {
        setIsRegisterMode(true);
        toast({
          title: t("user_not_found"),
          description: t("please_register_first"),
          variant: "destructive",
        });
        console.error("Login error:", error);
      } else {
        console.error("Login error:", error);
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
      const res = await (
        await apiClient.auth.register.$post({
          json: {
            name: data.name,
            password: data.password,
          },
        })
      ).json();

      window.localStorage.setItem("role", res.role);
      window.localStorage.setItem("id", res.id.toString());
      window.localStorage.setItem("token", res.token);

      const userData = await apiClient.user.info.$get().then((r) => r.json());

      authContext.updateUser(userData, undefined, "");
      authContext.setIsAuthenticated(true);

      router.navigate({ to: "/user/tickets/list", replace: true });
    } catch (error: unknown) {
      console.error("Registration error:", error);
      toast({
        title: t("registration_failed"),
        description:
          (error as { message?: string })?.message || t("registration_failed"),
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
            {isRegisterMode ? t("register_title") : t("login_title")}
          </CardTitle>
          <CardDescription>
            {isRegisterMode ? t("register_subtitle") : t("login_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
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
                  onClick={() => setIsRegisterMode(!isRegisterMode)}
                  disabled={isLoading}
                >
                  {isRegisterMode
                    ? t("btn_switch_to_login")
                    : t("btn_switch_to_register")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
