import type React from "react"
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon } from "lucide-react"

import { cn } from "tentix-ui/lib/utils"

interface CalloutProps {
  type?: "info" | "warning" | "error" | "success"
  title?: string
  children: React.ReactNode
  className?: string
}

export function Callout({ type = "info", title, children, className }: CalloutProps) {
  const icons = {
    info: InfoIcon,
    warning: AlertTriangleIcon,
    error: AlertCircleIcon,
    success: CheckCircleIcon,
  }

  const Icon = icons[type]

  const styles = {
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-900/50",
    warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-900/50",
    error: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900/50",
    success: "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-900/50",
  }

  const iconStyles = {
    info: "text-blue-600 dark:text-blue-400",
    warning: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
    success: "text-green-600 dark:text-green-400",
  }

  const titleStyles = {
    info: "text-blue-800 dark:text-blue-300",
    warning: "text-amber-800 dark:text-amber-300",
    error: "text-red-800 dark:text-red-300",
    success: "text-green-800 dark:text-green-300",
  }

  const contentStyles = {
    info: "text-blue-700 dark:text-blue-300/90",
    warning: "text-amber-700 dark:text-amber-300/90",
    error: "text-red-700 dark:text-red-300/90",
    success: "text-green-700 dark:text-green-300/90",
  }

  return (
    <div className={cn("my-6 rounded-md border p-4 flex gap-3", styles[type], className)}>
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", iconStyles[type])} />
      <div>
        {title && <div className={cn("font-medium mb-1", titleStyles[type])}>{title}</div>}
        <div className={cn("text-sm", contentStyles[type])}>{children}</div>
      </div>
    </div>
  )
}
