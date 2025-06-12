import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/user')({
  beforeLoad: async ({context: { authContext } }) => {
    console.log("User route auth check:", {
      userExists: authContext.user ? "yes" : "no",
      userId: authContext.user?.id,
      isAuthenticated: authContext.isAuthenticated
    });
    
    if (authContext.user?.id === undefined || authContext.user === null) {
      console.log("User route: redirecting to /notLogin due to missing user");
      redirect({
        to: "/notLogin",
        throw: true,
      });
    }
  },
  component: () => <Outlet />,
})
