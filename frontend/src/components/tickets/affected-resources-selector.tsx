import { ServerIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

interface AffectedResourcesSelectorProps {
  selectedResources: string[]
  setSelectedResources: (resources: string[]) => void
}

// Sample resources data
const availableResources = [
  { id: "servers", label: "Servers" },
  { id: "database", label: "Database" },
  { id: "network", label: "Network" },
  { id: "storage", label: "Storage" },
  { id: "api", label: "API Services" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "authentication", label: "Authentication" },
  { id: "payment", label: "Payment System" },
  { id: "reporting", label: "Reporting System" },
  { id: "monitoring", label: "Monitoring Tools" },
  { id: "cdn", label: "CDN" },
]

export function AffectedResourcesSelector({ selectedResources, setSelectedResources }: AffectedResourcesSelectorProps) {
  const toggleResource = (resourceId: string) => {
    setSelectedResources((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId],
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="affected-resources">Affected Resources</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            <div className="flex gap-1 flex-wrap">
              {selectedResources.length === 0 ? (
                <span className="text-muted-foreground">Select resources</span>
              ) : (
                selectedResources.map((id) => {
                  const resource = availableResources.find((r) => r.id === id)
                  return (
                    <Badge variant="secondary" key={id} className="mr-1 mb-1">
                      {resource?.label}
                    </Badge>
                  )
                })
              )}
            </div>
            <ServerIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search resources..." />
            <CommandList>
              <CommandEmpty>No resources found.</CommandEmpty>
              <CommandGroup>
                {availableResources.map((resource) => (
                  <CommandItem
                    key={resource.id}
                    onSelect={() => toggleResource(resource.id)}
                    className="flex items-center"
                  >
                    <div className="mr-2 flex h-4 w-4 items-center justify-center">
                      <Checkbox checked={selectedResources.includes(resource.id)} className="h-4 w-4" />
                    </div>
                    {resource.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
