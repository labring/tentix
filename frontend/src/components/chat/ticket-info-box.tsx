import { CalendarIcon, ClockIcon, TagIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Card, CardContent } from "tentix-ui";
import { Separator } from "tentix-ui";
import type { TicketType } from "tentix-server/rpc";
import ContentRenderer from "./content-renderer.tsx";
import { PriorityBadge, StatusBadge } from "tentix-ui";
import { useState, useRef, useEffect } from "react";
import { Button } from "tentix-ui";

export function TicketInfoBox({ ticket }: { ticket: TicketType }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkHeight = () => {
      if (contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const maxHeight = 15 * 16; // 15rem to pixels (1rem = 16px)
        setShowButton(contentHeight > maxHeight);
      }
    };

    checkHeight();
    // Add resize observer to handle dynamic content changes
    const resizeObserver = new ResizeObserver(checkHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [ticket.description]);

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
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
        </div>
        <div className="mt-2">
          <div 
            ref={contentRef}
            className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-none' : 'max-h-[15rem]'}`}
          >
            <ContentRenderer doc={ticket.description} />
          </div>
          {showButton && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 flex items-center justify-center gap-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon className="h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDownIcon className="h-4 w-4" />
                  Show More
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
