import { create } from "zustand";

import type { ticketModule } from "tentix-server/types";

interface AppConfigStore {
  ticketModules: ticketModule[];
  setTicketModules: (modules: ticketModule[]) => void;
}

export const useAppConfigStore = create<AppConfigStore>()((set) => ({
  ticketModules: [],
  setTicketModules: (modules) => set({ ticketModules: modules }),
}));

export const useTicketModules = () =>
  useAppConfigStore((state) => state.ticketModules);

/**
 * 根据 module code 和语言获取翻译值
 * @param code - module code
 * @param lang - 语言代码 (zh-CN | en-US)
 * @param ticketModules - ticket modules 数组
 * @returns 翻译值，如果没有找到则返回原始 code
 */
export const getModuleTranslation = (
  code: string,
  lang: "zh-CN" | "en-US",
  ticketModules: ticketModule[],
): string => {
  const moduleConfig = ticketModules.find((m) => m.code === code);
  return moduleConfig?.translations?.[lang] || code;
};
