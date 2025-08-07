import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RouteTransition } from "@comp/page-transition";

export const Route = createFileRoute("/user")({
  beforeLoad: async ({ context: { authContext } }) => {
    if (authContext.user?.id === undefined || authContext.user === null) {
      redirect({
        to: "/notLogin",
        throw: true,
      });
    }
  },
  component: () => (
    <RouteTransition>
      <Outlet />
    </RouteTransition>
  ),
});
