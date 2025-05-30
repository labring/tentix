import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/staff')({
  validateSearch: (search: Record<string, unknown>) => {
    if (search.token) {
      return {
        ...search,
        token: search.token as string,
      };
    }
    return search;
  },
  beforeLoad: async ({ search, context, location }) => {
    if (search.token) {
      window.localStorage.setItem('token', search.token as string);
      context.queryClient.invalidateQueries({ queryKey: ['getUserInfo'] })
      window.location.href = location.pathname
    }
    if (search.token === undefined && !context.authContext.isAuthenticated) {
      window.location.href = `/api/feishu/login?redirect=${  location.href}`;
      return;
    }
    if (context.authContext.user?.role === 'customer') {
      redirect({ to: '/user/tickets/list' })
      return;
    }
  },
  component: () => <Outlet />,
})
