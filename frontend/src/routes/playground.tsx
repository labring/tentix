import { createFileRoute } from '@tanstack/react-router'
import TestRenderer from 'tentix-ui/comp/chat/test-renderer'
import { Trans } from 'i18n'

export const Route = createFileRoute('/playground')({
  component: RouteComponent,
})

function RouteComponent() {

  return <div>Hello "/playground"!
<TestRenderer />
<Trans i18nKey="hello">
  hello
</Trans>
  </div>
}
