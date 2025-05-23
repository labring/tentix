import React from "react"
import { useRef } from "react"
import { GripVerticalIcon } from "lucide-react"
import { useResizablePanel } from "./use-resizable-panel.ts"

export function useLeftResizablePanel(
  options: {
    defaultWidth?: number
    minWidth?: number
    maxWidth?: number
  } = {},
) {
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const props = useResizablePanel(options)

  const LeftResizablePanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
      data-active={!props.isCollapsed}
      className={`relative flex h-full transition-all duration-300 ease-in-out w-0 data-[active=true]:w-[${options.defaultWidth}px]`}
      {
      ...(function(){
      if (!props.isCollapsed)
      return {
      style: { width: `${props.width}px` }
      }
      })()
      }
    >
      <div
        ref={resizeHandleRef}
        className={`absolute left-0 top-0 z-20 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-primary/10 -translate-x-1
          ${props.isCollapsed ? "hidden" : ""}`}
        onMouseDown={props.handleMouseDown}
      >
        <div className="flex h-16 w-full items-center justify-center rounded bg-muted hover:bg-muted-foreground/50">
          <GripVerticalIcon className="h-4 w-full text-muted-foreground" />
        </div>
      </div>
      <div className={`h-full w-full overflow-auto ${props.isCollapsed ? "invisible" : "visible"}`}>{children}</div>
    </div>
  )

  const res = {
    ...props,
    LeftResizablePanel,
  };

  return res;
}
