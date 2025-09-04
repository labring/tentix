import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { RouterContext } from "../router";
import { useTranslation } from "i18n";
import { useAuth } from "@hook/use-local-user.tsx";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  AlertTitle,
} from "tentix-ui";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Tentix Ticket System",
      },
      {
        title: "Tentix",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
    scripts: [
      (() => {
        if (import.meta.env.DEV) {
          return {
            src: "https://lf-package-cn.feishucdn.com/obj/feishu-static/op/fe/devtools_frontend/remote-debug-0.0.1-alpha.6.js",
          };
        }
      })(),
    ],
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  errorComponent: function ErrorComponent({ error, reset }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const authContext = useAuth();
    const resetLogin = () => {
      authContext.logout();
      navigate({ to: "." });
    };

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-2xl animate-fadeIn">
          <CardHeader>
            <CardTitle>{t("error_title")}</CardTitle>
            {/* 描述性文本 */}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">{t("error_message")}</p>

            <Alert variant="destructive">
              <AlertTitle>{error.message}</AlertTitle>
              {error.stack && (
                <AlertDescription>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed">{error.stack}</pre>
                </AlertDescription>
              )}
            </Alert>

            {error.message === "Unauthorized" && (
              <Alert>
                <AlertDescription>{t("unauthorized_message")}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="secondary" onClick={reset}>
              {t("reset")}
            </Button>
            <Button onClick={() => window.location.reload()}>
              {t("reload")}
            </Button>
            {error.message === "Unauthorized" && (
              <Button variant="outline" onClick={resetLogin}>
                {t("reset_login")}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  },
  notFoundComponent: function NotFoundComponent() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleGoBack = () => navigate({ to: "." });

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md text-center animate-fadeIn">
          <CardHeader>
            <CardTitle>{t("not_found_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-8">{t("not_found_message")}</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={handleGoBack}>{t("go_back")}</Button>
          </CardFooter>
        </Card>
      </div>
    );
  },
});
