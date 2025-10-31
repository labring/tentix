import * as React from "react";
import { Button, Checkbox, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "tentix-ui";
import { staffListQueryOptions, useSuspenseQuery } from "@lib/query";
import { useAuth } from "@hook/use-local-user.tsx";
import { useTranslation } from "i18n";
import { DateRangePicker } from "@comp/common/date-range-picker";


interface AnalyticsFilterProps {
  onDateRangeChange?: (dateRange: { from: Date; to: Date } | undefined) => void;
  onEmployeeChange?: (employeeId: string) => void;
  onRefresh?: () => void;
  onTodayToggle?: (isToday: boolean) => void;
  lastUpdated?: string;
}


//筛选逻辑
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
  const [selectedEmployee, setSelectedEmployee] = React.useState("all");
  
  const [initialTime] = React.useState(() => 
    new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
  
  const displayTime = lastUpdated || initialTime;

  const authContext = useAuth();
  const currentUser = authContext.user;

  //获取员工列表
  const { data: staffList } = useSuspenseQuery(staffListQueryOptions());

  const employees = React.useMemo(() => {
    return staffList?.map(staff => ({
      id: staff.id.toString(),
      name: staff.name || staff.nickname,
    })) || [];
  }, [staffList]);

  const employeeOptions = React.useMemo(() => {
    const defaultOption = { id: "all", name: t("all_staff") };
    
    if (currentUser?.role === "admin") {
      return [defaultOption, ...employees];
    }
    
    const currentUserOption = {
      id: currentUser?.id.toString() || "",
      name: currentUser?.name || currentUser?.nickname || t("my"),
    };
    
    return [defaultOption, currentUserOption];
  }, [employees, currentUser, t]);

  //日期范围选择
  const handleDateRangeChange = (newDateRange: { from: Date; to: Date } | undefined) => {
    setDateRange(newDateRange);
    if (newDateRange) {
      setIsTodayChecked(false); 
    }
    onDateRangeChange?.(newDateRange);
  };

  //员工选择
  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    onEmployeeChange?.(employeeId);
  };

  //今天筛选
  const handleTodayToggle = (checked: boolean) => {
    setIsTodayChecked(checked);
    if (checked) {
      setDateRange(undefined);
    }
    onTodayToggle?.(checked);
  };

  //格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between py-5 px-6 bg-white rounded-lg border border-zinc-200 gap-4">
      <div className="flex flex-wrap items-center space-x-4 gap-2">
        <span className="text-sm font-medium text-zinc-700">{t("analytics_filter")}</span>

        <div className="flex items-center space-x-2 px-3 py-2 border border-zinc-200 rounded-md">
          {/* 今天筛选 */}
          <Checkbox
            id="today-filter"
            checked={isTodayChecked}
            onCheckedChange={handleTodayToggle}
          />
          <Label htmlFor="today-filter" className="text-sm font-normal text-zinc-700">
            {t("today")}
          </Label>
        </div>

        {/* 日期范围选择 */}
        <DateRangePicker
          value={dateRange}
          onChange={handleDateRangeChange}
          disabled={isTodayChecked}
          formatDate={formatDate}
        />

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
          {t("reload")}
        </Button>
        <span className="text-sm text-zinc-500">{t("updated_at")} {displayTime}</span>
      </div>
    </div>
  );
}