import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button, Separator, SidebarTrigger } from "tentix-ui";
import { useTranslation } from "i18n";

interface SiteHeaderProps {
  title?: string;
  sidebarVisible?: boolean;
  toggleSidebar?: () => void;
}

export function SiteHeader({
  title,
  sidebarVisible,
  toggleSidebar,
}: SiteHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium max-w-200 truncate block">
          {title || t("work_orders")}
        </h1>

        {toggleSidebar && (
          <div className="ml-auto hidden md:block">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-background shadow-xs hover:bg-muted"
              onClick={toggleSidebar}
              aria-label={sidebarVisible ? t("expand_panel") : t("collapse_panel")}
            >
              {sidebarVisible ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (
                <ChevronLeftIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
