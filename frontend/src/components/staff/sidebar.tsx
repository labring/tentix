import { Link } from "@tanstack/react-router";
import { joinTrans, useTranslation } from "i18n";
import { LayersIcon, Settings, LogOut, Bot } from "lucide-react";
import { Button } from "tentix-ui";
import { useSettingsModal } from "@modal/use-settings-modal";
import { useSealos } from "src/_provider/sealos";
import { useAuth } from "@hook/use-local-user.tsx";

export function StaffSidebar() {
  const { t } = useTranslation();
  const { openSettingsModal, settingsModal } = useSettingsModal();
  const sealosContext = useSealos();
  const authContext = useAuth();
  const { isSealos } = sealosContext;

  return (
    <div className="py-3 px-2 hidden md:flex flex-col h-full items-center w-fit border-r-[0.8px] border-solid border-zinc-200 bg-zinc-50">
      <div className="flex flex-col gap-2 items-center">
        <Button
          asChild
          variant="ghost"
          className="flex flex-col w-[60px] h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500"
        >
          <Link
            to="/staff/tickets/list"
            className="flex flex-col items-center justify-center gap-1 text-center"
          >
            <LayersIcon className="!w-6 !h-6" strokeWidth={1.33} />
            <span className="text-[11px] leading-4 font-medium tracking-[0.5px] whitespace-nowrap font-['PingFang_SC']">
              {joinTrans([t("all"), t("tkt_other")])}
            </span>
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="flex flex-col w-[60px] h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500"
        >
          <Link
            to="/staff/ai"
            className="flex flex-col items-center justify-center gap-1 text-center"
          >
            <Bot className="!w-7 !h-7" strokeWidth={1.33} />
            <span className="text-[13px] leading-4 font-medium tracking-[0.5px] whitespace-nowrap font-['PingFang_SC']">
              {"AI"}
            </span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="flex flex-col w-[60px] h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500"
          onClick={openSettingsModal}
        >
          <Settings className="!w-6 !h-6" strokeWidth={1.33} />
          <span className="text-[11px] leading-4 font-medium tracking-[0.5px] whitespace-nowrap font-['PingFang_SC']">
            {t("settings")}
          </span>
        </Button>
      </div>
      {!isSealos && (
        <div className="flex-1 flex flex-col justify-end items-center">
          <Button
            variant="ghost"
            className="flex w-10 h-10 justify-center items-center gap-2 flex-shrink-0 rounded-lg border border-zinc-200 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-zinc-100 text-zinc-500 hover:text-zinc-500"
            onClick={() => {
              try {
                authContext.logout();
              } finally {
                window.location.replace("/login");
              }
            }}
          >
            <LogOut className="!w-5 !h-5" />
          </Button>
        </div>
      )}
      {settingsModal}
    </div>
  );
}
