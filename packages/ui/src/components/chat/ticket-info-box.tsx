import { CalendarIcon, ClockIcon, TagIcon } from "lucide-react";
import { Badge } from "../ui/badge.tsx";
import { Card, CardContent } from "../ui/card.tsx";
import { Separator } from "../ui/separator.tsx";
import type { TicketType } from "tentix-ui/lib/types";
import ContentRenderer from "./content-renderer.tsx";

export function TicketInfoBox({ ticket }: { ticket: TicketType }) {
  return (
    <Card className="m-12 overflow-hidden border bg-muted/30">
      <CardContent className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 w-full flex flex-col">
            <h3 className="text-base font-medium leading-none text-nowrap max-w-9/10 overflow-hidden text-ellipsis whitespace-nowrap block">
              {ticket.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <TagIcon className="h-3 w-3" />
                {ticket.category}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                {new Date(ticket.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  ticket.status === "Resolved"
                    ? "bg-green-500"
                    : ticket.status === "In Progress"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }
              >
                {ticket.status}
              </Badge>
              <Badge
                variant="outline"
                className={
                  ticket.priority === "urgent"
                    ? "border-red-500 text-red-500"
                    : ticket.priority === "high"
                      ? "border-orange-500 text-orange-500"
                      : ticket.priority === "medium"
                        ? "border-amber-500 text-amber-500"
                        : "border-green-500 text-green-500"
                }
              >
                {ticket.priority} Priority
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-2 max-h-[100px] overflow-y-auto">
          <ContentRenderer content={ticket.description} />
        </div>
      </CardContent>
    </Card>
  );
}
