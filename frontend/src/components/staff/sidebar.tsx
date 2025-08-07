import { Link, useLocation } from "@tanstack/react-router";
import { joinTrans, useTranslation } from "i18n";
import { LayersIcon } from "lucide-react";
import { Button } from "tentix-ui";

export function StaffSidebar() {
  const pathname = useLocation().pathname;
  const { t } = useTranslation();

  return (
    <div className="py-3 px-2 hidden md:flex flex-col h-full items-center w-fit border-r-[0.8px] border-solid border-zinc-200 bg-zinc-50">
      <div className="flex flex-col gap-2 items-center">
        <Button
          asChild
          variant="ghost"
          className={`flex flex-col w-[60px] h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500 ${
            pathname === "/staff/tickets/list" ||
            (pathname.startsWith("/staff/tickets/") &&
              pathname !== "/staff/tickets/all")
              ? "bg-black/[0.04] text-zinc-900"
              : ""
          }`}
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
        {/* <Button
          asChild
          variant="ghost"
          className={`flex flex-col w-[60px] h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500 ${
            pathname === "/staff/tickets/all"
              ? "bg-black/[0.04] text-zinc-900"
              : ""
          }`}
        >
          <Link
            to="/staff/tickets/all"
            className="flex flex-col items-center justify-center gap-1 text-center"
          >
            <LayersIcon className="!w-6 !h-6" strokeWidth={1.33} />
            <span className="text-[11px] leading-4 font-medium tracking-[0.5px] whitespace-nowrap font-['PingFang_SC']">
              {joinTrans([t("all"), t("tkt_other")])}
            </span>
          </Link>
        </Button> */}
      </div>
    </div>
  );
}
