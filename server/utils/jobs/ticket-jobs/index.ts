import { ticketAutoCloseJob } from "./ticketAutoClose";

export function startTicketAutoCloseJob() {
  const job = ticketAutoCloseJob();
  return { job };
}
