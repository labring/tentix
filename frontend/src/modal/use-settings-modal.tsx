import { useBoolean } from "ahooks";
import { useTranslation } from "i18n";
import { useState, Suspense } from "react";
import { Button, Dialog, DialogContent, cn, ScrollArea } from "tentix-ui";
import {
  sectionsConfig,
  getFirstVisibleSection,
} from "./settings-sections/config.tsx";
import { SettingsSkeleton } from "./settings-sections/SettingsSkeleton";
import { useAuth } from "@hook/use-local-user.tsx";

export function useSettingsModal() {
  const [state, { set, setTrue, setFalse }] = useBoolean(false);
  const [activeSection, setActiveSection] = useState<
    "userInfo" | "accountBinding" | "userManagement" | "ticketModule"
  >("userInfo");
  const { t } = useTranslation();
  const { user } = useAuth();

  // Function to open the settings modal
  function openSettingsModal(
    section?: "userInfo" | "accountBinding" | "userManagement" | "ticketModule",
  ) {
    setTrue();
    setActiveSection(
      section ?? getFirstVisibleSection({ role: user?.role ?? "customer" }),
    );
  }

  const modal = (
    <Dialog open={state} onOpenChange={set}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[620px] md:max-w-[880px] lg:max-w-[980px] !rounded-2xl border-0">
        {/* 主体区域，参照示例为左侧窄栏 + 右侧内容 */}
        <div className="flex h-[560px]">
          {/* 左侧侧边栏 */}
          <div className="hidden md:flex w-[260px] shrink-0 border-r bg-zinc-50/70">
            <div className="w-full p-4">
              <div className="space-y-2">
                {sectionsConfig
                  .filter((s) =>
                    s.isVisible({ role: user?.role ?? "customer" }),
                  )
                  .map((s) => (
                    <Button
                      key={s.id}
                      variant={activeSection === s.id ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start h-10 px-3 text-sm rounded-xl",
                        activeSection === s.id
                          ? "bg-white shadow-sm"
                          : "hover:bg-zinc-100",
                      )}
                      onClick={() => setActiveSection(s.id)}
                    >
                      {s.getSidebarLabel(t)}
                    </Button>
                  ))}
              </div>
            </div>
          </div>

          {/* 右侧内容区，包含顶部面包屑式标题 */}
          <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center px-5">
              <div className="text-sm text-zinc-500">
                <span className="hidden md:inline">{t("settings")}</span>
                <span className="hidden md:inline mx-2">/</span>
                <span className="text-zinc-900 font-medium">
                  {sectionsConfig
                    .find((s) => s.id === activeSection)
                    ?.getBreadcrumbLabel(t)}
                </span>
              </div>
            </header>
            <ScrollArea className="flex-1 overflow-y-auto p-5 pt-0">
              <Suspense fallback={<SettingsSkeleton />}>
                {sectionsConfig
                  .filter(
                    (s) =>
                      s.isVisible({ role: user?.role ?? "customer" }) &&
                      s.id === activeSection,
                  )
                  .map((s) => (
                    <div key={s.id}>{s.render(undefined as never)}</div>
                  ))}
              </Suspense>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return {
    state,
    openSettingsModal,
    closeSettingsModal: setFalse,
    settingsModal: modal,
  };
}
