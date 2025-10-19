import * as React from "react";
import { SparklesIcon, VariableIcon } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Kbd,
} from "tentix-ui";
import type { WorkflowVariable } from "./workflow-variables";
import { cn } from "@lib/utils";
import { useTranslation } from "i18n";

interface VariableInserterProps {
  /**
   * Available variables to show in the menu
   */
  variables: WorkflowVariable[];

  /**
   * Callback when a variable is selected
   */
  onSelect: (variable: WorkflowVariable) => void;

  /**
   * Additional className for the container
   */
  className?: string;
}

/**
 * Variable selector component using Command menu
 * Displays global and node-specific variables grouped by category
 */
export const VariableInserter: React.FC<VariableInserterProps> = ({
  variables,
  onSelect,
  className,
}) => {
  const { t } = useTranslation();
  // Group variables by category
  const globalVars = React.useMemo(
    () => variables.filter((v) => v.category === "global"),
    [variables],
  );
  const nodeVars = React.useMemo(
    () => variables.filter((v) => v.category === "node"),
    [variables],
  );

  // Group node variables by node type
  const nodeVarsByType = React.useMemo(() => {
    const grouped = new Map<string, WorkflowVariable[]>();
    nodeVars.forEach((v) => {
      if (v.nodeType) {
        const key = v.nodeType;
        const existing = grouped.get(key) || [];
        grouped.set(key, [...existing, v]);
      }
    });
    return grouped;
  }, [nodeVars]);

  const getNodeTypeName = (nodeType: string): string => {
    // i18n node type names
    const key = `rf.nodeType.${nodeType}`;
    const translated = t(key);
    return translated === key ? nodeType : translated;
  };

  return (
    <div
      className={cn(
        "w-[400px] z-50",
        "rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none",
        className,
      )}
    >
      <Command>
        <CommandInput placeholder={t("rf.var.search_placeholder") as string} />
        <CommandList>
          <CommandEmpty>{t("rf.var.not_found")}</CommandEmpty>

          {/* Global Variables */}
          {globalVars.length > 0 && (
            <CommandGroup heading={t("rf.var.global_group")}>
              {globalVars.map((variable) => (
                <CommandItem
                  key={variable.name}
                  value={variable.name}
                  onSelect={() => onSelect(variable)}
                  className="flex items-start gap-2 py-2"
                >
                  <SparklesIcon className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{variable.name}</span>
                      <Kbd className="text-xs">{`{{ ${variable.name} }}`}</Kbd>
                    </div>
                    <span className="text-xs text-muted-foreground">{t(variable.description)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Node Variables - Grouped by Node Type */}
          {Array.from(nodeVarsByType.entries()).map(([nodeType, vars]) => (
            <CommandGroup
              key={nodeType}
              heading={t("rf.var.node_group", { name: getNodeTypeName(nodeType) })}
            >
              {vars.map((variable) => (
                <CommandItem
                  key={variable.name}
                  value={variable.name}
                  onSelect={() => onSelect(variable)}
                  className="flex items-start gap-2 py-2"
                >
                  <VariableIcon className="h-4 w-4 mt-0.5 text-purple-500" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{variable.name}</span>
                      <Kbd className="text-xs">{`{{ ${variable.name} }}`}</Kbd>
                    </div>
                    <span className="text-xs text-muted-foreground">{t(variable.description)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  );
};
