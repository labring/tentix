import { createFileRoute, redirect } from "@tanstack/react-router";
import { areaEnumArray, userRoleEnumArray } from "@server/utils/const";
type initSearch = {
  token: string;
  area: (typeof areaEnumArray)[number];
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): initSearch => {
    return {
      token: search.token ?? "",
      area: search.area ?? "hzh",
    } as initSearch;
  },
  beforeLoad: async ({ search, context }) => {
    if (search.token === "") {
      redirect({
        to: "/notLogin",
        throw: true,
      });
    }
    
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
    
    if (!context.authContext.isAuthenticated || idChanged) {
      try {
        const url = new URL("/api/auth/login", window.location.origin);
        url.searchParams.set("token", search.token);
        url.searchParams.set("area", search.area);
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error("Authentication failed");
        }
        
        const data = (await res.json()) as {
          id: string;
          uid: string;
          role: (typeof userRoleEnumArray)[number];
        };
        
        window.localStorage.setItem("role", data.role);
        window.localStorage.setItem("id", data.id);
        
        // 使用context的revalidateAuth方法而不是刷新页面
        if (context.revalidateAuth) {
          context.revalidateAuth();
        }
        
        if (idChanged) {
          context.queryClient.invalidateQueries({ queryKey: ['getUserInfo'] });
        }
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
