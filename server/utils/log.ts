/* eslint-disable no-console */
import { styleText } from "util";

type LogLevel = "info" | "success" | "warning" | "error" | "debug" | "start";

interface LogStyle {
  text: Parameters<typeof styleText>[0];
  bg?: Parameters<typeof styleText>[0];
}

const LOG_STYLES: Record<LogLevel, LogStyle> = {
  info: {
    text: ["blueBright", "bold"],
  },
  success: {
    text: ["green", "bold"],
  },
  warning: {
    text: ["yellow", "bold"],
  },
  error: {
    text: ["white", "bold"],
    bg: "bgRed",
  },
  debug: {
    text: ["magentaBright", "bold"],
  },
  start: {
    text: ["cyanBright", "bold"],
  },
};

/**
 * Base logging function that applies consistent styling
 */
function logWithStyle(level: LogLevel, message: string, prefix?: string) {
  if (process.env.NODE_ENV === "production") {
    if (["error", "warning"].includes(level)) {
      console.error(message);
    } else {
      console.log(message);
    }
    return;
  }
  const style = LOG_STYLES[level];
  const timestamp = new Date().toLocaleTimeString();
  const formattedMessage = prefix
    ? `[${timestamp}] ${prefix} ${message}`
    : `[${timestamp}] ${message}`;
  const styles = [...style.text, style.bg];

  console.log(
    styleText(styles as Parameters<typeof styleText>[0], formattedMessage),
  );
}

/**
 * Log an informational message
 */
export function logInfo(message: string) {
  logWithStyle("info", message, "📘");
}

/**
 * Log a success message
 */
export function logSuccess(message: string) {
  logWithStyle("success", message, "✨");
}

/**
 * Log a warning message
 */
export function logWarning(message: string) {
  logWithStyle("warning", message, "⚠️");
}

/**
 * Log an error message
 */
export function logError(message: string, error?: unknown) {
  logWithStyle("error", message, "💥");
  if (error) {
    console.error(error);
  }
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(message: string) {
  if (process.env.NODE_ENV === "development") {
    logWithStyle("debug", message, "🔧");
  }
}

/**
 * Log a process start message
 */
export function logStart(message: string) {
  logWithStyle("start", message, "🚀");
}

/**
 * Log a process completion message
 */
export function logComplete(message: string) {
  logSuccess(`${message}`);
}

/**
 * Create a task logger that logs start and completion
 */
export async function withTaskLog<T>(
  taskName: string,
  task: () => Promise<T>,
): Promise<T> {
  try {
    logStart(`${taskName}...`);
    const result = await task();
    logSuccess(`${taskName} completed successfully!`);
    return result;
  } catch (error) {
    logError(`${taskName} failed!`, error);
    throw error;
  }
}
