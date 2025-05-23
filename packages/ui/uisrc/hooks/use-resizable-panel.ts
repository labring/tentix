import React from "react"

import { useState, useRef, useEffect } from "react"

interface UseResizablePanelOptions {
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}

export function useResizablePanel({
  defaultWidth = 350,
  minWidth = 250,
  maxWidth = 500,
}: UseResizablePanelOptions = {}) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [wasExpanded, setWasExpanded] = useState(true)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const deltaX = e.clientX - startXRef.current
      // For right-side panel, subtract deltaX from startWidth
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current - deltaX))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth])

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      // Prevent text selection during resize
      const selectStart = (e: Event) => e.preventDefault()
      document.addEventListener("selectstart", selectStart)

      return () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        document.removeEventListener("selectstart", selectStart)
      }
    }
  }, [isResizing])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  const toggleCollapse = () => {
    if (isCollapsed) {
      // Expanding
      setWidth(defaultWidth)
      setIsCollapsed(false)
      setWasExpanded(true)
    } else {
      // Collapsing
      setWidth(0)
      setIsCollapsed(true)
      setWasExpanded(false)
    }
  }

  const expandFull = () => {
    setWidth(maxWidth)
    setIsCollapsed(false)
    setWasExpanded(true)
  }

  return {
    width,
    isResizing,
    isCollapsed,
    wasExpanded,
    handleMouseDown,
    toggleCollapse,
    expandFull,
  }
}
