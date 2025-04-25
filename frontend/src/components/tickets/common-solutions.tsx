import { useState } from "react"
import { ChevronDown, ChevronUp, Flame } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Solution {
  id: string
  question: string
  answer?: string
  isHot?: boolean
  link?: string
}

interface CommonSolutionsProps {
  title: string
  solutions: Solution[]
  expanded?: boolean
}

export function CommonSolutions({ title, solutions, expanded = false }: CommonSolutionsProps) {
  const [isExpanded, setIsExpanded] = useState(expanded)

  return (
    <div className="mb-6">
      <Button variant="outline" className="w-full justify-between text-left" onClick={() => setIsExpanded(!isExpanded)}>
        <span>{title}</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {isExpanded && (
        <Card className="mt-2 border border-muted">
          <CardContent className="p-4">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              以下高频问题工单已被完美解决，可能有您要的答案：
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {solutions.map((solution) => (
                <div key={solution.id} className="border-b border-dashed border-muted pb-3 last:border-0">
                  <div className="flex items-start">
                    <span className="mr-2 text-muted-foreground">•</span>
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium">{solution.question}</span>
                        {solution.isHot && (
                          <Badge variant="outline" className="ml-2 bg-red-500 text-white">
                            <Flame className="mr-1 h-3 w-3" />热
                          </Badge>
                        )}
                      </div>
                      {solution.answer && <p className="mt-1 text-sm text-muted-foreground">{solution.answer}</p>}
                      {solution.link && (
                        <a
                          href={solution.link}
                          className="mt-1 block text-sm text-primary hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看详细解决方案
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
