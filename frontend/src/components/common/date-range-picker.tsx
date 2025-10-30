import { Button, Popover, PopoverContent, PopoverTrigger, Calendar } from "tentix-ui";
import { CalendarIcon } from "lucide-react";
import { cn } from "@lib/utils";
import { useTranslation } from "i18n";

interface DateRangePickerProps {
  value?: { from: Date; to: Date };//日期范围
  onChange?: (dateRange: { from: Date; to: Date } | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  formatDate?: (date: Date) => string;
  numberOfMonths?: number;
}

//日期范围选择组件
export function DateRangePicker({
  value,
  onChange,
  disabled = false,
  placeholder,
  className,
  formatDate: customFormatDate,
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const { t } = useTranslation();

  //格式化日期
  const defaultFormatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = customFormatDate || defaultFormatDate;

  //日期范围选择
  const handleDateRangeChange = (newDateRange: { from: Date | undefined; to?: Date | undefined } | undefined) => {
    if (newDateRange?.from && newDateRange?.to) {
      const range = { from: newDateRange.from, to: newDateRange.to };
      onChange?.(range);
    } else {
      onChange?.(undefined);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date-range-picker"
          variant="outline"
          className={cn(
            "w-[300px] justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.from ? (
            value.to ? (
              `${formatDate(value.from)} - ${formatDate(value.to)}`
            ) : (
              formatDate(value.from)
            )
          ) : (
            <span>{placeholder || t("select")}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={handleDateRangeChange}
          numberOfMonths={numberOfMonths}
        />
      </PopoverContent>
    </Popover>
  );
}

