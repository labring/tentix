import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { initClient } from "@server/utils/rpc.ts";

export const apiClient = initClient("");

export type { InferRequestType, InferResponseType } from "@server/utils/rpc.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// const formatDate = (dateString: string) => {
//   const date = new Date(dateString);
//   const today = new Date();
//   const yesterday = new Date(today);
//   yesterday.setDate(yesterday.getDate() - 1);

//   if (date.toDateString() === today.toDateString()) {
//     return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
//   } else if (date.toDateString() === yesterday.toDateString()) {
//     return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
//   } else {
//     return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
//       hour: "2-digit",
//       minute: "2-digit",
//     })}`;
//   }
// };

export function timeAgo(date: Date | string, hasTimezoneOffset = true) {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const now = new Date();
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const diffInSeconds =
    (now.getTime() -
      dateObj.getTime() +
      (hasTimezoneOffset ? now.getTimezoneOffset() * 60000 : 0)) /
    1000;
  if (diffInSeconds < 60)
    return rtf.format(-Math.floor(diffInSeconds), "second");
  if (diffInSeconds < 3600)
    return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
  if (diffInSeconds < 86400)
    return rtf.format(-Math.floor(diffInSeconds / 3600), "hour");
  if (diffInSeconds < 604800)
    return rtf.format(-Math.floor(diffInSeconds / 86400), "day");
  if (diffInSeconds < 2419200)
    return rtf.format(-Math.floor(diffInSeconds / 604800), "week");
  if (diffInSeconds < 29030400)
    return rtf.format(-Math.floor(diffInSeconds / 2419200), "month");
  return rtf.format(-Math.floor(diffInSeconds / 29030400), "year");
}
