import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/staff')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      revalidate: Boolean(search.revalidate ?? false) || undefined,
    };
  },
  beforeLoad: async ({ search, context, location }) => {
    if (!context.authContext.isAuthenticated || import.meta.env.DEV) {
      if (search.revalidate) {
        context.queryClient.invalidateQueries({ queryKey: ['getUserInfo'] })
        return;
      }
      if (!context.authContext.isAuthenticated) {
        window.location.href = '/api/feishu/login?redirect=' + location.href;
        return;
      }
    }
  },
  component: () => <Outlet />,
})
