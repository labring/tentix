import { createFileRoute, redirect } from "@tanstack/react-router";
import { areaEnumArray } from "tentix-server/constants";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const identity = window.localStorage.getItem("identity");
    const area = window.localStorage.getItem("area");
    if (!identity || !area) {
      redirect({
        to: "/notLogin",
        throw: true,
      });
      return;
    }
    if (!context.authContext.isAuthenticated) {
      try {
        const res = await (
          await context.apiClient.auth.login.$get({
            query: {
              token: identity,
              area: area as (typeof areaEnumArray)[number],
            },
          })
        ).json();

        window.localStorage.setItem("role", res.role);
        window.localStorage.setItem("id", res.id.toString());
        window.localStorage.setItem("token", res.token);
        context.queryClient.invalidateQueries({ queryKey: ["getUserInfo"] });
      } catch (error) {
        console.error("Authentication error:", error);
        window.localStorage.removeItem("identity");
        window.localStorage.removeItem("area");
        redirect({
          to: "/notLogin",
          throw: true,
        });
      }
    }
    const role = window.localStorage.getItem("role");
    switch (role) {
      case "technician":
      case "agent":
        redirect({
          to: "/staff/dashboard",
          throw: true,
          search: {
            revalidate: undefined,
          },
        });
        break;
      default:
        redirect({
          to: "/user/tickets/list",
          throw: true,
        });
        break;
    }
  },
  component: App,
});

function App() {
  return <div></div>;
}
