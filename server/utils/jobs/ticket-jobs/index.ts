import { ticketAutoCloseJob } from "./ticketAutoClose";
import { ticketAutoPendingJob } from "./ticketAutoPending";

export function startTicketAutoCloseJob() {
  const autoCloseJob = ticketAutoCloseJob();
  const autoPendingJob = ticketAutoPendingJob();
  return { autoCloseJob, autoPendingJob };
}
