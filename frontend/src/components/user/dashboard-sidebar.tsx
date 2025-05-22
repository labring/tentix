import {
  MessageSquare,
  PlusCircle, Users
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "tentix-ui";
import { Avatar, AvatarFallback, AvatarImage } from "tentix-ui";
import { Button } from "tentix-ui";
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "i18n";
import useLocalUser from "@hook/use-local-user.tsx";
export function UserDashboardSidebar() {
  const { t } = useTranslation();
  const pathname = useLocation().pathname;
  const user = useLocalUser();
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.avatar} />
            <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="text-sm font-medium">{user.name}</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {/* <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/user/dashboard"}
            >
              <Link to="/user/dashboard">
                <Home />
                <span>{t("dashboard")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem> */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/user/tickets/list"}
            >
              <Link to="/user/tickets/list">
                <MessageSquare />
                <span>{t("tkt_list")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/user/newticket"}
            >
              <Link to="/user/newticket">
                <PlusCircle />
                <span>{t("tkt_create")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/user/knowledge-base">
                <FileText />
                <span>{t("knowledge_base")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem> */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/user/community"}
            >
              <a
                href="https://forum.sealos.run"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Users />
                <span>{t("community")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/user/settings"}>
              <Link to="/user/settings">
                <Settings />
                <span>{t("settings")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem> */}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link to="/user/newticket">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("tkt_create")}
          </Link>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
