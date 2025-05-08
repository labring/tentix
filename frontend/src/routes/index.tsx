import { createFileRoute, redirect } from "@tanstack/react-router";
import { areaEnumArray, userRoleEnumArray } from "@server/utils/const";
type initSearch = {
  token: string;
  area: (typeof areaEnumArray)[number];
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): initSearch => {
    return {
      token: (search.token as string) || "",
      area: (search.area as (typeof areaEnumArray)[number]) || "hzh",
    };
  },
  beforeLoad: async ({ search, context }) => {
    let idChanged = false;
    const identity = window.localStorage.getItem("identity");
    const area = window.localStorage.getItem("area");
    if (identity || area) {
      if (search.token !== identity || search.area !== area) {
        idChanged = true;
      }
    }
    window.localStorage.setItem("identity", search.token);
    window.localStorage.setItem("area", search.area);
    if (!context.authContext.isAuthenticated || idChanged || import.meta.env.DEV) {
      const url = new URL("/api/auth/login", window.location.origin);
      url.searchParams.set("token", search.token);
      url.searchParams.set("area", search.area);

      const res = await fetch(url);
      const data = (await res.json()) as {
        id: string;
        uid: string;
        role: (typeof userRoleEnumArray)[number];
      };
      console.log(data);
      window.localStorage.setItem("role", data.role);
      window.localStorage.setItem("id", data.id);
    }
    switch (window.localStorage.getItem("role")) {
      case "customer":
        redirect({
          to: "/user/tickets/list",
          throw: true,
        });
        break;
      default:
        redirect({
          to: "/staff/dashboard",
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
