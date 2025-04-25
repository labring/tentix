import type React from "react"

import { useRouter } from "@tanstack/react-router"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  HelpCircle,
  Laptop,
  Building,
  Shield,
  Users,
  BookOpen,
  AlertTriangle,
  FileQuestion,
} from "lucide-react"

interface Category {
  id: string
  title: string
  description: string
  icon: React.ElementType
  hasCommonSolutions?: boolean
}

export function SupportCategories() {
  const router = useRouter()

  const categories: Category[] = [
    {
      id: "it-support",
      title: "IT Support",
      description: "Get help with software, hardware, and network issues.",
      icon: Laptop,
      hasCommonSolutions: true,
    },
    {
      id: "facilities",
      title: "Facilities",
      description: "Report building maintenance issues and request repairs.",
      icon: Building,
    },
    {
      id: "security",
      title: "Security",
      description: "Report security concerns or request access to secure areas.",
      icon: Shield,
      hasCommonSolutions: true,
    },
    {
      id: "hr-assistance",
      title: "HR Assistance",
      description: "Get help with HR-related questions and requests.",
      icon: Users,
    },
    {
      id: "get-started",
      title: "Get Started",
      description: "Learn the basics of our support system and how to submit tickets.",
      icon: HelpCircle,
      hasCommonSolutions: true,
    },
    {
      id: "knowledge-base",
      title: "Knowledge Base",
      description: "Browse our documentation for self-service solutions.",
      icon: BookOpen,
    },
    {
      id: "emergency-support",
      title: "Emergency Support",
      description: "Get immediate assistance for critical issues.",
      icon: AlertTriangle,
      hasCommonSolutions: true,
    },
    {
      id: "help-faq",
      title: "Help & FAQ",
      description: "Find answers to frequently asked questions.",
      icon: FileQuestion,
    },
  ]

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/user/support/${categoryId}`)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => (
        <Card key={category.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{category.title}</CardTitle>
              <category.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardDescription>{category.description}</CardDescription>
          </CardHeader>
          <CardContent className="pb-2"></CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full justify-between" onClick={() => handleCategoryClick(category.id)}>
              <span>查看详情</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
