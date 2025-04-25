import { useState } from "react"
import { BookIcon, BookOpenIcon, ExternalLinkIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Sample knowledge base articles
const knowledgeBaseArticles = [
  {
    id: "1",
    title: "Troubleshooting HVAC Systems",
    category: "HVAC",
    content:
      "Common issues with HVAC systems include thermostat malfunctions, airflow problems, and refrigerant leaks. This guide covers basic troubleshooting steps for maintenance staff.",
    tags: ["HVAC", "Troubleshooting", "Maintenance"],
  },
  {
    id: "2",
    title: "Network Connectivity Issues",
    category: "IT",
    content:
      "This article covers common network connectivity problems, including Wi-Fi signal issues, router configuration, and network adapter troubleshooting steps.",
    tags: ["IT", "Network", "Connectivity"],
  },
  {
    id: "3",
    title: "Plumbing Emergency Procedures",
    category: "Plumbing",
    content:
      "Learn how to handle plumbing emergencies such as burst pipes, major leaks, and clogged drains. Includes steps to minimize damage while waiting for professional assistance.",
    tags: ["Plumbing", "Emergency", "Water Damage"],
  },
  {
    id: "4",
    title: "Electrical Safety Guidelines",
    category: "Electrical",
    content:
      "Safety procedures for handling electrical issues, including circuit breaker problems, outlet malfunctions, and lighting issues. Always prioritize safety when dealing with electrical systems.",
    tags: ["Electrical", "Safety", "Guidelines"],
  },
  {
    id: "5",
    title: "Conference Room Equipment Setup",
    category: "IT",
    content:
      "Step-by-step guide for setting up and troubleshooting conference room equipment, including projectors, video conferencing systems, and audio equipment.",
    tags: ["IT", "Conference Room", "Equipment"],
  },
]

// Sample categories
const categories = ["All", "HVAC", "IT", "Plumbing", "Electrical"]

export function KnowledgeBase() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedArticle, setSelectedArticle] = useState<(typeof knowledgeBaseArticles)[0] | null>(null)

  const filteredArticles = knowledgeBaseArticles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedCategory === "All" || article.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookIcon className="mr-2 h-4 w-4" />
          Knowledge Base
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Knowledge Base</DialogTitle>
          <DialogDescription>Search for articles and guides to help resolve common issues.</DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search knowledge base..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs defaultValue="browse" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Articles</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="flex-1 flex flex-col mt-0">
            {selectedArticle ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)}>
                    Back to Articles
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    Open in New Tab
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-md flex-1 overflow-auto">
                  <h3 className="text-lg font-semibold mb-2">{selectedArticle.title}</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedArticle.tags.map((tag) => (
                      <span key={tag} className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">Category: {selectedArticle.category}</p>
                  <div className="prose prose-sm dark:prose-invert">
                    <p>{selectedArticle.content}</p>
                    {/* This would contain the full article content in a real implementation */}
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                      nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <h4>Common Issues</h4>
                    <ul>
                      <li>Issue one with detailed explanation and troubleshooting steps</li>
                      <li>Issue two with detailed explanation and troubleshooting steps</li>
                      <li>Issue three with detailed explanation and troubleshooting steps</li>
                    </ul>
                    <h4>Resolution Steps</h4>
                    <ol>
                      <li>First step in the resolution process</li>
                      <li>Second step with additional details</li>
                      <li>Final verification steps</li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-2 p-1">
                  {filteredArticles.length > 0 ? (
                    filteredArticles.map((article) => (
                      <button
                        key={article.id}
                        className="w-full text-left p-3 rounded-md hover:bg-muted flex items-start gap-3 transition-colors"
                        onClick={() => setSelectedArticle(article)}
                      >
                        <BookOpenIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium">{article.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {article.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="bg-secondary text-secondary-foreground text-xs px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No articles found matching your search criteria.
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="categories" className="flex-1 mt-0">
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`p-4 rounded-md border text-left hover:bg-muted transition-colors ${
                    selectedCategory === category ? "border-primary" : "border-border"
                  }`}
                  onClick={() => {
                    setSelectedCategory(category)
                    setSearchQuery("")
                  }}
                >
                  <h3 className="font-medium">{category}</h3>
                  <p className="text-sm text-muted-foreground">
                    {category === "All"
                      ? `${knowledgeBaseArticles.length} articles`
                      : `${knowledgeBaseArticles.filter((a) => a.category === category).length} articles`}
                  </p>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
