import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { RouterContext } from "../router";
import { useTranslation } from "i18n";
import { lazy } from "react";
import { useAuth } from "@hook/use-local-user.tsx"

const IdentitySwitcher = lazy(() => import("../components/identity-switcher.tsx"));

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
      {import.meta.env.DEV && <IdentitySwitcher />}
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
      <div className="flex flex-col items-center justify-center h-screen text-center px-5">
        <h1 className="text-3xl font-bold mb-4">{t("error_title")}</h1>
        <p className=" text-gray-600">{t("error_message")}</p>
        <div className="flex flex-col gap-2 content-start justify-start my-4">
          <p className="text-gray-600">{error.message}</p>
          <p className="text-gray-600">{error.stack}</p>
        </div>
        {
          error.message === 'Unauthorized' && <p className="text-gray-600">{t("unauthorized_message")}</p>
        }
        <div className="flex flex-row gap-2">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t("reset")}
        </button>
        <button
          onClick={window.location.reload}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t("reload")}
        </button>
        {
          error.message === 'Unauthorized' && <button
          onClick={resetLogin}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t("reset_login")}
        </button>
        }
        </div>
      </div>
    );
  },
  notFoundComponent: function NotFoundComponent() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleGoBack = () => navigate({ to: "." });

    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-5">
        <h1 className="text-3xl font-bold mb-4">{t("not_found_title")}</h1>
        <p className="text-xl text-gray-600 mb-8">{t("not_found_message")}</p>
        <button
          onClick={handleGoBack}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t("go_back")}
        </button>
      </div>
    );
  },
});
