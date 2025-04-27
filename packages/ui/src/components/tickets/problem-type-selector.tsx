import { Card, CardContent } from "../ui/card.tsx"
import { Badge } from "../ui/badge.tsx"

interface ProblemType {
  id: string
  name: string
  description: string
  hasCommonSolutions?: boolean
}

interface ProblemTypeSelectorProps {
  problemTypes: ProblemType[]
  selectedType: string | null
  onSelect: (id: string) => void
}

export function ProblemTypeSelector({ problemTypes, selectedType, onSelect }: ProblemTypeSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-1">
      {problemTypes.map((type) => (
        <Card
          key={type.id}
          className={`cursor-pointer transition-all hover:border-primary hover:shadow-xs border-2 ${
            selectedType === type.id ? "border-primary" : "border-gray-200"
          }`}
          onClick={() => onSelect(type.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="mb-1 font-medium">{type.name}</h3>
              {type.hasCommonSolutions && (
                <Badge variant="outline" className="ml-2 bg-blue-500 text-white">
                  推荐
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{type.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
