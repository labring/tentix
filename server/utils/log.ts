import { styleText } from "util";

type LogLevel = "info" | "success" | "warning" | "error" | "debug" | "start";

interface LogStyle {
  bg: string[];
  text: string[];
}

const LOG_STYLES: Record<LogLevel, LogStyle> = {
  info: { bg: ["bgBlue"], text: ["white"] },
  success: { bg: ["bgGreenBright"], text: ["black"] },
  warning: { bg: ["bgYellow"], text: ["black"] },
  error: { bg: ["bgRedBright"], text: ["white"] },
  debug: { bg: ["bgMagenta"], text: ["white"] },
  start: { bg: ["bgCyan"], text: ["black"] },
};

/**
 * Base logging function that applies consistent styling
 */
function logWithStyle(level: LogLevel, message: string, prefix?: string) {
  const style = LOG_STYLES[level];
  const formattedMessage = prefix ? `${prefix} ${message}` : message;
  // @ts-ignore
  console.log(styleText([...style.bg, ...style.text], formattedMessage));
}

/**
 * Log an informational message
 */
export function logInfo(message: string) {
  logWithStyle("info", message, "ℹ️");
}

/**
 * Log a success message
 */
export function logSuccess(message: string) {
  logWithStyle("success", message, "✅");
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
  logWithStyle("error", message, "❌");
  if (error) {
    console.error(error);
  }
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(message: string) {
  if (process.env.NODE_ENV === "development") {
    logWithStyle("debug", message, "🔍");
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
  logSuccess(`✨ ${message}`);
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