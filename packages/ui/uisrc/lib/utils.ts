import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
export function timeAgo(date: Date | string) {
  const now = new Date();
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const diffInSeconds = (now.getTime() - dateObj.getTime()) / 1000;
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

const timeRtf = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function timeFmt(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24),
  );

  // For today, show only time (HH:mm)
  if (diffInDays === 0) {
    return timeRtf.format(dateObj);
  }

  // For within 3 days, show days and time
  if (diffInDays <= 3) {
    return `${rtf.format(-Math.floor(diffInDays), "day")} ${timeRtf.format(dateObj)}`;
  }

  // For this year, show month and day
  if (dateObj.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
    }).format(dateObj);
  }

  // For older dates, show full date
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);
}

export function dateTimeFmt(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = (now.getTime() - dateObj.getTime()) / 1000;
  
  // For within 1 hour, show relative time
  if (diffInSeconds < 3600) {
    if (diffInSeconds < 60) {
      return rtf.format(-Math.floor(diffInSeconds), "second");
    }
    return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
  }
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDateObj = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  // Check if it's today
  const isToday = startOfToday.getTime() === startOfDateObj.getTime();
  
  // Check if it's within one year
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const isWithinOneYear = dateObj > oneYearAgo;

  // For today, show only time (HH:mm)
  if (isToday) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dateObj);
  }

  // For within one year, show date + time
  if (isWithinOneYear) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dateObj);
  }

  // For over one year, show full date + time
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj);
}
