import { useRaiseReqModal } from "@modal/use-raise-req-modal";
import { useTransferModal } from "@modal/use-transfer-modal";
import { useUpdateStatusModal } from "@modal/use-update-status-modal";
import { useTranslation } from "i18n";
import { PanelLeft } from "lucide-react";
import { type TicketType } from "tentix-server/rpc";
import { Button } from "tentix-ui";

interface SiteHeaderProps {
  ticket: TicketType;
  sidebarVisible?: boolean;
  toggleSidebar?: () => void;
}

export function StaffSiteHeader({
  ticket,
  sidebarVisible,
  toggleSidebar,
}: SiteHeaderProps) {
  const { openRaiseReqModal, raiseReqModal, isRaisingReq } = useRaiseReqModal();
  const { openTransferModal, transferModal, isTransferring } =
    useTransferModal();
  const { openUpdateStatusModal, updateStatusModal, isUpdatingStatus } =
    useUpdateStatusModal();
  const { t } = useTranslation();

  return (
    <header className="flex h-14 w-full border-b items-center justify-between px-4 ">
      <div className="flex items-center gap-1">
        {toggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 justify-center items-center rounded-md cursor-pointer flex xl:flex"
            onClick={toggleSidebar}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-base font-medium max-w-200 truncate block">
          {ticket.title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => openRaiseReqModal(ticket.id)}
          disabled={isRaisingReq}
        >
          {t("raise_request")}
        </Button>
        <Button
          onClick={() => openTransferModal(ticket.id)}
          disabled={isTransferring}
        >
          {t("transfer")}
        </Button>
        <Button
          onClick={() => openUpdateStatusModal(ticket.id, ticket.status)}
          disabled={isUpdatingStatus}
        >
          {t("update_status")}
        </Button>
      </div>
      {raiseReqModal}
      {transferModal}
      {updateStatusModal}
    </header>
  );
}
