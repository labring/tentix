import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/user/newticket')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/user/newticket"!</div>
}


