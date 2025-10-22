import { useMemo, useState } from "react";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "tentix-ui";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@lib/utils";

export type CommonComboboxProps<OptionType> = {
  options: OptionType[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  noneLabel?: string;
  showNoneOption?: boolean;
  getOptionId: (option: OptionType) => string;
  getOptionLabel: (option: OptionType) => string;
  getOptionDescription?: (option: OptionType) => string | undefined;
  className?: string;
};

export function CommonCombobox<OptionType>(
  props: CommonComboboxProps<OptionType>,
) {
  const {
    options,
    value,
    onChange,
    disabled = false,
    placeholder = "请选择",
    searchPlaceholder = "搜索...",
    noneLabel = "不选择",
    showNoneOption = true,
    getOptionId,
    getOptionLabel,
    getOptionDescription,
    className,
  } = props;

  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    return options.find((o) => getOptionId(o) === value) ?? null;
  }, [options, value, getOptionId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between bg-transparent", className)}
        >
          {selected ? getOptionLabel(selected) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>未找到匹配项</CommandEmpty>
            <CommandGroup>
              {showNoneOption ? (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {noneLabel}
                </CommandItem>
              ) : null}
              {options.map((option) => {
                const optionId = getOptionId(option);
                const label = getOptionLabel(option);
                const description = getOptionDescription?.(option);
                return (
                  <CommandItem
                    key={optionId}
                    value={label}
                    onSelect={() => {
                      onChange(optionId);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected && getOptionId(selected) === optionId
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{label}</span>
                      {description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {description}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default CommonCombobox;
