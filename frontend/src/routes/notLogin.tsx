import { createFileRoute, redirect } from '@tanstack/react-router'
import { PriorityBadge } from 'tentix-ui'

export const Route = createFileRoute('/notLogin')({
  beforeLoad: async ({ context: { authContext } }) => {
    if (authContext.user?.id !== undefined && authContext.user !== null) {
      redirect({
        to: "/user/tickets/list",
        throw: true,
      });
    }
  },
  component: RouteComponent,
})
function RouteComponent() {
  return <div>当前您未正常登录，请关闭应用。刷新页面后，重新进入此应用！<PriorityBadge priority="urgent" /></div>
}
