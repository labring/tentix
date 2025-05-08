import type React from "react"

import { useEffect, useState } from "react"
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, CopyIcon, ExternalLinkIcon, InfoIcon, FileTextIcon } from "lucide-react"

import { cn } from "tentix-ui/lib/utils"
import { Button } from "../ui/button.tsx"
import { ScrollArea } from "../ui/scroll-area.tsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.tsx"

type TableOfContentsItem = {
  id: string
  title: string
  level: number
  children?: TableOfContentsItem[]
}

type RelatedDoc = {
  title: string
  url: string
}

interface SolutionLayoutProps {
  title: string
  description: string
  category: string
  lastUpdated: string
  tableOfContents: TableOfContentsItem[]
  relatedDocs?: RelatedDoc[]
  children: React.ReactNode
}

export function SolutionLayout({
  title,
  description,
  category,
  lastUpdated,
  tableOfContents,
  relatedDocs,
  children,
}: SolutionLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>(tableOfContents[0]?.id || "")

  // Function to handle intersection observer
  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.target.id) {
        setActiveSection(entry.target.id)
      }
    })
  }

  // Set up intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "0px 0px -80% 0px",
      threshold: 0.1,
    })

    // Observe all section headings
    document.querySelectorAll("h2, h3, h4").forEach((heading) => {
      if (heading.id) {
        observer.observe(heading)
      }
    })

    return () => {
      observer.disconnect()
    }
  })

  return (
    <div className="container mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left sidebar - Table of Contents (desktop only) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6">
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-1 text-muted-foreground">ON THIS PAGE</h3>
              <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                <nav className="space-y-1 py-2">
                  {tableOfContents.map((item) => (
                    <div key={item.id}>
                      <Link
                        href={`#${item.id}`}
                        className={cn(
                          "block py-1 text-sm transition-colors hover:text-foreground",
                          activeSection === item.id
                            ? "font-medium text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={(e) => {
                          e.preventDefault()
                          document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })
                          setActiveSection(item.id)
                        }}
                      >
                        {item.title}
                      </Link>
                      {item.children && item.children.length > 0 && (
                        <div className="ml-4 space-y-1 border-l pl-2 pt-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.id}
                              href={`#${child.id}`}
                              className={cn(
                                "block py-1 text-sm transition-colors hover:text-foreground",
                                activeSection === child.id
                                  ? "font-medium text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              onClick={(e) => {
                                e.preventDefault()
                                document.getElementById(child.id)?.scrollIntoView({ behavior: "smooth" })
                                setActiveSection(child.id)
                              }}
                            >
                              {child.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              </ScrollArea>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs for navigation */}
          <div className="block lg:hidden mb-6">
            <Tabs defaultValue="content">
              <TabsList className="w-full">
                <TabsTrigger value="content" className="flex-1">
                  Content
                </TabsTrigger>
                <TabsTrigger value="toc" className="flex-1">
                  On This Page
                </TabsTrigger>
              </TabsList>
              <TabsContent value="toc" className="mt-2 border rounded-md p-4">
                <ScrollArea className="h-[300px]">
                  <nav className="space-y-1">
                    {tableOfContents.map((item) => (
                      <div key={item.id}>
                        <Link
                          href={`#${item.id}`}
                          className={cn(
                            "block py-1 text-sm transition-colors hover:text-foreground",
                            activeSection === item.id
                              ? "font-medium text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={(e) => {
                            e.preventDefault()
                            document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })
                            setActiveSection(item.id)
                          }}
                        >
                          {item.title}
                        </Link>
                        {item.children && item.children.length > 0 && (
                          <div className="ml-4 space-y-1 border-l pl-2 pt-1">
                            {item.children.map((child) => (
                              <Link
                                key={child.id}
                                href={`#${child.id}`}
                                className={cn(
                                  "block py-1 text-sm transition-colors hover:text-foreground",
                                  activeSection === child.id
                                    ? "font-medium text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={(e) => {
                                  e.preventDefault()
                                  document.getElementById(child.id)?.scrollIntoView({ behavior: "smooth" })
                                  setActiveSection(child.id)
                                }}
                              >
                                {child.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </nav>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="content" className="mt-0">
                {/* Content header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Link href="/user/docs" className="hover:text-foreground">
                      文档中心
                    </Link>
                    <ChevronRightIcon className="h-4 w-4" />
                    <Link href="/user/docs/solutions" className="hover:text-foreground">
                      解决方案
                    </Link>
                    <ChevronRightIcon className="h-4 w-4" />
                    <span>{category}</span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">{title}</h1>
                  <p className="text-muted-foreground mb-2">{description}</p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>最后更新: {lastUpdated}</span>
                  </div>
                </div>

                {/* Main content */}
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  {children}
                </div>

                {/* Related docs */}
                {relatedDocs && relatedDocs.length > 0 && (
                  <div className="mt-12 border-t pt-6">
                    <h3 className="font-medium mb-4">相关文档</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {relatedDocs.map((doc) => (
                        <Link
                          key={doc.title}
                          href={doc.url}
                          className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                        >
                          <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                          <span>{doc.title}</span>
                          <ExternalLinkIcon className="h-4 w-4 ml-auto text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback section */}
                <div className="mt-12 border-t pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <InfoIcon className="h-5 w-5 text-muted-foreground" />
                      <span>这篇文档对您有帮助吗？</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        有帮助
                      </Button>
                      <Button variant="outline" size="sm">
                        需要改进
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Desktop content */}
          <div className="hidden lg:block">
            {/* Content header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Link href="/user/docs" className="hover:text-foreground">
                  文档中心
                </Link>
                <ChevronRightIcon className="h-4 w-4" />
                <Link href="/user/docs/solutions" className="hover:text-foreground">
                  解决方案
                </Link>
                <ChevronRightIcon className="h-4 w-4" />
                <span>{category}</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{title}</h1>
              <p className="text-muted-foreground mb-2">{description}</p>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>最后更新: {lastUpdated}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto gap-1.5 text-xs h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                  }}
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  <span>复制链接</span>
                </Button>
              </div>
            </div>

            {/* Main content */}
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {children}
            </div>

            {/* Related docs */}
            {relatedDocs && relatedDocs.length > 0 && (
              <div className="mt-12 border-t pt-6">
                <h3 className="font-medium mb-4">相关文档</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedDocs.map((doc) => (
                    <Link
                      key={doc.title}
                      href={doc.url}
                      className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                      <span>{doc.title}</span>
                      <ExternalLinkIcon className="h-4 w-4 ml-auto text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback section */}
            <div className="mt-12 border-t pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <InfoIcon className="h-5 w-5 text-muted-foreground" />
                  <span>这篇文档对您有帮助吗？</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    有帮助
                  </Button>
                  <Button variant="outline" size="sm">
                    需要改进
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
