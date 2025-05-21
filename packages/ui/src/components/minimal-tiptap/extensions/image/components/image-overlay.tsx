import * as React from "react"
import { Spinner } from "../../../components/spinner.tsx"
import { cn } from "@ui/lib/utils.ts"

export const ImageOverlay = React.memo(() => {
  return (
    <div
      className={cn(
        "flex flex-row items-center justify-center",
        "absolute inset-0 rounded bg-[var(--mt-overlay)] opacity-100 transition-opacity"
      )}
    >
      <Spinner className="size-7" />
    </div>
  )
})

ImageOverlay.displayName = "ImageOverlay"
