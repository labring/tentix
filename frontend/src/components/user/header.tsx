import { PanelLeft } from "lucide-react";
import { Button } from "tentix-ui";

interface SiteHeaderProps {
  title: string;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
}

export function SiteHeader({
  title = "Work Orders",
  sidebarVisible,
  toggleSidebar,
}: SiteHeaderProps) {
  return (
    <div className="flex h-14 w-full border-b items-center  px-4 ">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 justify-center items-center rounded-md cursor-pointer hidden xl:flex"
          onClick={toggleSidebar}
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <h1
          className="max-w-200 truncate block 
                       text-[#000] 
                       text-[16px] 
                       font-[600] 
                       leading-[100%]"
        >
          {title}
        </h1>
      </div>
    </div>
  );
}
