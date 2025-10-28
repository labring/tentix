import type { TFunction } from "i18next";
import type { ReactElement } from "react";
import { AccountBindingSection } from "./AccountBindingSection";
import { UserInfoSection } from "./UserInfoSection";
import { UserManagementSection } from "./UserManagementSection";
import { TicketModuleSection } from "./TicketModuleSection";

export type SectionId =
  | "userInfo"
  | "accountBinding"
  | "userManagement"
  | "ticketModule";

export type SettingsContext = never;

export type SectionConfig = {
  id: SectionId;
  getSidebarLabel: (t: TFunction) => string;
  getBreadcrumbLabel: (t: TFunction) => string;
  isVisible: (userInfo: { role: string }) => boolean;
  render: (ctx: SettingsContext) => ReactElement;
};

export const sectionsConfig: SectionConfig[] = [
  {
    id: "userInfo",
    getSidebarLabel: (t) => t("user_info"),
    getBreadcrumbLabel: (t) => t("user_info"),
    isVisible: () => true,
    render: () => <UserInfoSection />,
  },
  {
    id: "accountBinding",
    getSidebarLabel: (t) => t("account_binding"),
    getBreadcrumbLabel: (t) => t("account_binding_manage"),
    isVisible: (userInfo) => !["customer", "ai"].includes(userInfo.role),
    render: () => <AccountBindingSection />,
  },
  {
    id: "userManagement",
    getSidebarLabel: () => "用户管理",
    getBreadcrumbLabel: () => "用户管理",
    isVisible: (userInfo) => !["customer", "ai"].includes(userInfo.role),
    render: () => <UserManagementSection />,
  },
  {
    id: "ticketModule",
    getSidebarLabel: (t) => t("ticket_module_management"),
    getBreadcrumbLabel: (t) => t("ticket_module_management"),
    isVisible: (userInfo) => !["customer", "ai"].includes(userInfo.role),
    render: () => <TicketModuleSection />,
  },
];

export function getFirstVisibleSection(userInfo: { role: string }): SectionId {
  const found = sectionsConfig.find((s) => s.isVisible(userInfo));
  return found ? found.id : "userInfo";
}
