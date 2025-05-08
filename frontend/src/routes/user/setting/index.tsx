import { createFileRoute } from '@tanstack/react-router'
import { ContactInfoSection } from 'tentix-ui/comp/tickets/contact-info-section'

export const Route = createFileRoute('/user/setting/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <ContactInfoSection
  contactTime={contactTime}
  setContactTime={setContactTime}
  specificStartTime={specificStartTime}
  setSpecificStartTime={setSpecificStartTime}
  specificEndTime={specificEndTime}
  setSpecificEndTime={setSpecificEndTime}
  ccEmails={ccEmails}
  setCcEmails={setCcEmails}
/>
}
