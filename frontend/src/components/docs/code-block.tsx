import type React from "react"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

import { cn } from "tentix-ui"
import { Button } from "tentix-ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "tentix-ui"

interface CodeBlockProps {
  code: string | Record<string, string>
  language?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  className?: string
  title?: string
}

export function CodeBlock({
  code,
  language = "bash",
  showLineNumbers = true,
  highlightLines = [],
  className,
  title,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const isMultiple = typeof code !== "string"
  const [activeTab, setActiveTab] = useState<string>(isMultiple ? Object.keys(code)[0] : "default")

  const handleCopy = () => {
    const textToCopy = isMultiple ? code[activeTab] : (code as string)
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderCodeBlock = (codeString: string, lang: string = language) => (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-muted/80 hover:bg-muted text-muted-foreground"
          onClick={handleCopy}
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          <span className="sr-only">Copy code</span>
        </Button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        lineProps={(lineNumber) => {
          const style: React.CSSProperties = { display: "block" }
          if (highlightLines.includes(lineNumber)) {
            style.backgroundColor = "rgba(255, 255, 255, 0.1)"
          }
          return { style }
        }}
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          fontSize: "0.875rem",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  )

  if (isMultiple) {
    const codeObj = code as Record<string, string>
    return (
      <div className={cn("rounded-md border my-6", className)}>
        {title && <div className="px-4 py-2 border-b text-sm font-medium">{title}</div>}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
            <TabsList className="h-8 p-0.5 bg-muted/80">
              {Object.keys(codeObj).map((key) => (
                <TabsTrigger key={key} value={key} className="h-7 px-3 text-xs data-[state=active]:bg-background">
                  {key}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {Object.entries(codeObj).map(([key, value]) => (
            <TabsContent key={key} value={key} className="mt-0 rounded-none">
              {renderCodeBlock(value)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    )
  }

  return (
    <div className={cn("rounded-md border my-6 overflow-hidden", className)}>
      {title && <div className="px-4 py-2 border-b text-sm font-medium bg-muted/40">{title}</div>}
      {renderCodeBlock(code as string)}
    </div>
  )
}
