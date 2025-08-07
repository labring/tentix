import { PanelLeft, CircleStopIcon } from "lucide-react";
import { Button } from "tentix-ui";
import { useTranslation } from "i18n";
import { type TicketType } from "tentix-server/rpc";
import { useCustomerFeedbackModal } from "@modal/use-customer-feedback-modal";

interface SiteHeaderProps {
  title: string;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  ticket?: TicketType;
}

export function SiteHeader({
  title,
  sidebarVisible,
  toggleSidebar,
  ticket,
}: SiteHeaderProps) {
  const { t } = useTranslation();

  const { openCustomerFeedbackModal, customerFeedbackModal, isSubmitting } =
    useCustomerFeedbackModal();

  const isResolved = ticket?.status === "resolved";

  const handleCloseTicket = () => {
    if (ticket) {
      openCustomerFeedbackModal(ticket.id);
    }
  };

  return (
    <>
      <div className="flex h-14 w-full border-b items-center justify-between px-4 ">
        <div className="flex items-center gap-1">
          {toggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 justify-center items-center rounded-md cursor-pointer hidden xl:flex"
              onClick={toggleSidebar}
              aria-label={
                sidebarVisible ? t("hide_sidebar") : t("show_sidebar")
              }
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          )}
          <h1
            className="max-w-100 2xl:max-w-100 xl:max-w-100 lg:max-w-60 md:max-w-40 sm:max-w-20 truncate block 
                       text-[#000] 
                       text-[16px] 
                       font-[600] 
                       leading-[100%]"
          >
            {title || t("work_orders")}
          </h1>
        </div>
        {ticket && (
          <Button
            variant="default"
            className="bg-black hover:bg-black/90 px-3 py-2 h-auto flex items-center"
            disabled={isResolved || isSubmitting}
            onClick={handleCloseTicket}
          >
            <CircleStopIcon className="h-4 w-4 text-white" />
            <span className="text-white text-sm font-medium leading-[20px]">
              {isSubmitting ? t("closing") : t("close_ticket")}
            </span>
          </Button>
        )}
      </div>
      {customerFeedbackModal}
    </>
  );
}
