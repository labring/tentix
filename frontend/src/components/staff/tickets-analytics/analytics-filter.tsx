import * as React from "react";
import { Button, Checkbox, Label, Popover, PopoverContent, PopoverTrigger, Calendar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "tentix-ui";
import { CalendarIcon, RefreshCcw } from "lucide-react";
import { cn } from "@lib/utils";
import { staffListQueryOptions, useSuspenseQuery } from "@lib/query";
import { useAuth } from "@hook/use-local-user.tsx";
import { useTranslation } from "i18n";


interface AnalyticsFilterProps {
  onDateRangeChange?: (dateRange: { from: Date; to: Date } | undefined) => void;
  onEmployeeChange?: (employeeId: string) => void;
  onRefresh?: () => void;
  onTodayToggle?: (isToday: boolean) => void;
  lastUpdated?: string;
}

export function AnalyticsFilter({
  onDateRangeChange,
  onEmployeeChange,
  onRefresh,
  onTodayToggle,
  lastUpdated,
}: AnalyticsFilterProps) {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date } | undefined>();
  const [isTodayChecked, setIsTodayChecked] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] = React.useState("all_staff");
  
  const [initialTime] = React.useState(() => 
    new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
  
  const displayTime = lastUpdated || initialTime;

  const authContext = useAuth();
  const currentUser = authContext.user;

  const { data: staffList } = useSuspenseQuery(staffListQueryOptions());

  const employees = React.useMemo(() => {
    return staffList?.map(staff => ({
      id: staff.id.toString(),
      name: staff.name || staff.nickname,
    })) || [];
  }, [staffList]);

  const employeeOptions = React.useMemo(() => {
    const defaultOption = { id: "all_staff", name: t("all_staff") };
    
    if (currentUser?.role === "admin") {
      return [defaultOption, ...employees];
    }
    
    const currentUserOption = {
      id: currentUser?.id.toString() || "",
      name: currentUser?.name || currentUser?.nickname || t("my"),
    };
    
    return [defaultOption, currentUserOption];
  }, [employees, currentUser, t]);

  const handleDateRangeChange = (newDateRange: { from: Date | undefined; to?: Date | undefined } | undefined) => {
    if (newDateRange?.from && newDateRange?.to) {
      const range = { from: newDateRange.from, to: newDateRange.to };
      setDateRange(range);
      setIsTodayChecked(false); 
      onDateRangeChange?.(range);
    } else {
      setDateRange(undefined);
      onDateRangeChange?.(undefined);
    }
  };

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    onEmployeeChange?.(employeeId);
  };

  const handleTodayToggle = (checked: boolean) => {
    setIsTodayChecked(checked);
    if (checked) {
      setDateRange(undefined);
    }
    onTodayToggle?.(checked);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between p-4 bg-white rounded-lg border border-zinc-200 mb-6 gap-4">
      <div className="flex flex-wrap items-center space-x-4 gap-2">
        <span className="text-sm font-medium text-zinc-700">{t("analytics_filter")}</span>

        <div className="flex items-center space-x-2 px-3 py-2 border border-zinc-200 rounded-md">
          <Checkbox
            id="today-filter"
            checked={isTodayChecked}
            onCheckedChange={handleTodayToggle}
          />
          <Label htmlFor="today-filter" className="text-sm font-normal text-zinc-700">
            {t("today")}
          </Label>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date-range-picker"
              variant="outline"
              className={cn(
                "w-[300px] justify-start text-left font-normal h-10",
                !dateRange && "text-muted-foreground"
              )}
              disabled={isTodayChecked} 
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                ) : (
                  formatDate(dateRange.from)
                )
              ) : (
                <span>{t("select")}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Select value={selectedEmployee} onValueChange={handleEmployeeChange}>
          <SelectTrigger className="w-[180px] h-10">
            <SelectValue placeholder={t("select_employee")} />
          </SelectTrigger>
          <SelectContent>
            {employeeOptions.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 右侧刷新和更新时间区域 */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {t("reload")}
        </Button>
        <span className="text-sm text-zinc-500">{t("updated_at")} {displayTime}</span>
      </div>
    </div>
  );
}