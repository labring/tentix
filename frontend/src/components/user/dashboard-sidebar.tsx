import { MessagesSquare, Plus, LayersIcon } from "lucide-react";

import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "i18n";

export function UserDashboardSidebar() {
  const { t } = useTranslation();
  const pathname = useLocation().pathname;
  return (
    <div className="w-fit">
      <div className="py-3 px-2 flex flex-col h-full items-center">
        {/* 上面两个按钮组成一组 */}
        <div className="flex flex-col gap-2 items-center">
          <div
            className={`flex flex-col w-full h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500 ${
              pathname === "/user/tickets/list"
                ? "bg-black/[0.04] text-zinc-900"
                : ""
            }`}
          >
            <Link
              to="/user/tickets/list"
              className="flex flex-col items-center justify-center gap-1 text-center"
            >
              <LayersIcon className="!w-6 !h-6" />
              <span className="text-[11px] leading-4 font-medium tracking-[0.5px] whitespace-nowrap">
                {t("tkt_list")}
              </span>
            </Link>
          </div>
          <div
            className={`flex flex-col w-full h-auto p-2 justify-center items-center gap-1 rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-500 ${
              pathname === "/user/community"
                ? "bg-black/[0.04] text-zinc-900"
                : ""
            }`}
          >
            <a
              href="https://forum.sealos.run"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 text-center"
            >
              <MessagesSquare className="!w-6 !h-6" />
              <span className="text-[11px] leading-4 font-medium tracking-[0.5px] whitespace-nowrap">
                {t("community")}
              </span>
            </a>
          </div>
        </div>
        {/* 下面独立一个按钮，靠近底部 */}
        <div className="flex-1 flex flex-col justify-end items-center">
          <div
            className={`flex w-10 h-10 px-4 py-2 justify-center items-center gap-2 flex-shrink-0 rounded-lg border border-zinc-200 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:bg-zinc-100 text-zinc-500 hover:text-zinc-500 ${
              pathname === "/user/newticket" ? "bg-zinc-100 text-zinc-900" : ""
            }`}
          >
            <Link
              to="/user/newticket"
              className="flex flex-col items-center justify-center"
            >
              <Plus className="!w-5 !h-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
