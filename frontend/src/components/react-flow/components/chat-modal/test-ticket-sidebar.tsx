import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  ScrollArea,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyStateIcon,
} from "tentix-ui";
import { Plus, ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";
import { apiClient } from "@lib/api-client";
import { useWorkflowTestChatStore } from "@store/workflow-test-chat";
import { NewTestTicket } from "./new-test-ticket";
import { cn } from "@lib/utils";
import { useBoolean } from "ahooks";

interface TestTicketSidebarProps {
  onTicketsLoaded?: (hasTickets: boolean) => void;
}

export function TestTicketSidebar({ onTicketsLoaded }: TestTicketSidebarProps) {
  const [collapsed, { toggle: toggleCollapsed }] = useBoolean(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { currentTicketId, setCurrentTicketId, currentWorkflowId } =
    useWorkflowTestChatStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["testTickets", currentWorkflowId, searchKeyword],
    queryFn: async () => {
      if (!currentWorkflowId) {
        return {
          testTickets: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: 1,
        };
      }
      const res = await apiClient.admin["test-ticket"][":workflowId"].all.$get({
        param: { workflowId: currentWorkflowId },
        query: {
          page: "1",
          pageSize: "50",
          keyword: searchKeyword || undefined,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch test tickets");
      return res.json();
    },
    enabled: !!currentWorkflowId,
  });

  // Notify parent when tickets are loaded
  useEffect(() => {
    if (data && onTicketsLoaded) {
      onTicketsLoaded((data.testTickets?.length ?? 0) > 0);
    }
  }, [data, onTicketsLoaded]);

  const handleSelectTicket = (ticketId: string) => {
    setCurrentTicketId(ticketId);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    refetch();
  };

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="absolute top-4 left-4 z-10 h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <div className="w-80 border-r border-border flex flex-col bg-muted/30">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Test Tickets</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleCollapsed}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-none">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {!currentWorkflowId ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Please select a workflow first
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data?.testTickets && data.testTickets.length > 0 ? (
            <div className="p-2 space-y-1">
              {data.testTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-md transition-colors hover:bg-accent",
                    currentTicketId === ticket.id
                      ? "bg-accent"
                      : "bg-transparent",
                  )}
                >
                  <div className="font-medium text-sm truncate">
                    {ticket.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {ticket.id} • {ticket.module}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <button
              className="flex h-[25rem] w-full items-center justify-center cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => setCreateModalOpen(true)}
            >
              <div className="flex flex-col items-center space-y-3 w-4/5 text-center">
                <EmptyStateIcon className="w-24 h-24 [&_*]:transition-colors [&_*]:fill-zinc-400 group-hover:[&_[data-hover-fill]]:fill-zinc-700" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  暂无测试工单,点击创建第一个测试工单
                </p>
              </div>
            </button>
          )}
        </ScrollArea>
      </div>

      {/* Create Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Test Ticket</DialogTitle>
          </DialogHeader>
          <NewTestTicket
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
