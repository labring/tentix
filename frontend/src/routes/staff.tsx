import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import useLocalUser from 'tentix-ui/hooks/use-local-user.tsx';

export const Route = createFileRoute('/staff')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      revalidate: Boolean(search.revalidate ?? false) || undefined,
    };
  },
  beforeLoad: async ({ search, context, location }) => {
    console.log(context.authContext)
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
