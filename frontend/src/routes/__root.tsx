import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { RouterContext } from "../router";
import { useTranslation } from "i18n";

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
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  errorComponent: ({ error, info, reset }) => {
    const { t } = useTranslation();
    console.log(error, info, reset);

    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-5">
        <h1 className="text-3xl font-bold mb-4">{t("error_title")}</h1>
        <p className=" text-gray-600">{t("error_message")}</p>
        <div className="flex flex-col gap-2 content-start justify-start">
          <p className="text-gray-600">{error.message}</p>
          <p className="text-gray-600">{error.stack}</p>
        </div>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t("reset")}
        </button>
      </div>
    );
  },
  notFoundComponent: () => {
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
