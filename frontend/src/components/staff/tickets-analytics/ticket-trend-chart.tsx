import { useMemo } from "react";
import { ChartContainer, ChartTooltip } from "tentix-ui";
import type { ChartConfig } from "tentix-ui";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ticketTrendsQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";

const getTrendChartConfig = (t: any) => ({
  count: {
    label: t("ticket_count"),
    color: "#2563EB",
  },
}) satisfies ChartConfig;

const getResponseChartConfig = (t: any) => ({
  firstResponse: {
    label: t("average_first_response_time"),
    color: "#10B981",
  },
  resolution: {
    label: t("average_resolution_time"), 
    color: "#2563EB",
  },
}) satisfies ChartConfig;

interface FilterParams {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  granularity?: "hour" | "day" | "month" | "year";
}

interface TicketTrendChartProps {
  filterParams?: FilterParams;
  isLoading?: boolean;
}

export function TicketTrendChart({ 
  filterParams = {},
  isLoading: externalLoading = false,
}: TicketTrendChartProps) {
  const { t } = useTranslation();
  
  const finalFilterParams = useMemo(() => {
    if (!filterParams.startDate || !filterParams.endDate) {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      
      return {
        ...filterParams,
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    }
    return filterParams;
  }, [filterParams]);

  const convertDateToTimestampRange = (dateStr: string, isEndDate: boolean = false) => {
    const date = new Date(dateStr);
    if (isEndDate) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    
    const tzOffset = -date.getTimezoneOffset();
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const tzSign = tzOffset >= 0 ? '+' : '-';
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzSign}${tzHours}:${tzMinutes}`;
  };

  const granularity = useMemo(() => {
    const { startDate, endDate } = finalFilterParams;
    
    if (!startDate || !endDate) {
      return "day";
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isSameDay = start.toDateString() === end.toDateString();
    
    if (isSameDay || diffDays <= 1) {
      return "hour";
    } else if (diffDays <= 60) {
      return "day";
    } else if (diffDays <= 730) {
      return "month";
    } else {
      return "year";
    }
  }, [finalFilterParams.startDate, finalFilterParams.endDate]);

  const granularityOptions = [
    { value: "hour", label: t("hourly") },
    { value: "day", label: t("daily") },
    { value: "month", label: t("monthly") },
    { value: "year", label: t("yearly") },
  ] as const;

  const queryParams = {
    ...finalFilterParams,
    granularity: granularity as "hour" | "day" | "month",
    startDate: finalFilterParams.startDate ? convertDateToTimestampRange(finalFilterParams.startDate, false) : undefined,
    endDate: finalFilterParams.endDate ? convertDateToTimestampRange(finalFilterParams.endDate, true) : undefined,
  };

  const { data } = useSuspenseQuery(ticketTrendsQueryOptions(queryParams));

  const loading = externalLoading;

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-zinc-200 rounded-lg"></div>
            <div className="h-96 bg-zinc-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    switch (granularity) {
      case "hour":
        const hour = date.getHours();
        return `${hour.toString().padStart(2, '0')}:00`;
      case "day":
        return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
      case "month":
        return date.toLocaleDateString("zh-CN", { year: "numeric", month: "numeric" });
      case "year":
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
    }
  };

  let formattedTrendsData;
  
  if (granularity === "hour") {
    const fixedHours: Array<{
      displayDate: string;
      fullDate: string;
      count: number;
      hour: number;
    }> = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      fixedHours.push({
        displayDate: hourStr,
        fullDate: `${finalFilterParams.startDate?.split('T')[0]}T${hourStr}:00`,
        count: 0, 
        hour: hour, 
      });
    }
    
    if (data?.trends) {
      data.trends.forEach(item => {
        const itemDate = new Date(item.date);
        const hour = itemDate.getHours();
        const fixedItem = fixedHours.find(h => h.hour === hour);
        if (fixedItem) {
          fixedItem.count = item.count;
        }
      });
    }
    
    formattedTrendsData = fixedHours;
  } else {
    formattedTrendsData = data?.trends?.map(item => ({
      ...item,
      displayDate: formatDateForDisplay(item.date),
      fullDate: item.date,
    })) || [];
  }

  const minutesToHours = (minutes: number) => {
    return Number((minutes / 60).toFixed(1));
  };

  let formattedResponseData;
  
  if (granularity === "hour") {
    const fixedHoursResponse: Array<{
      displayDate: string;
      fullDate: string;
      firstResponse: number;
      resolution: number;
      hour: number;
    }> = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      fixedHoursResponse.push({
        displayDate: hourStr,
        fullDate: `${finalFilterParams.startDate?.split('T')[0]}T${hourStr}:00`,
        firstResponse: 0, 
        resolution: 0,
        hour: hour, 
      });
    }
    
    if (data?.responseTimeTrends) {
      data.responseTimeTrends.forEach(item => {
        const itemDate = new Date(item.date);
        const hour = itemDate.getHours();
        const fixedItem = fixedHoursResponse.find(h => h.hour === hour);
        if (fixedItem) {
          fixedItem.firstResponse = minutesToHours(item.firstResponse);
          fixedItem.resolution = minutesToHours(item.resolution);
        }
      });
    }
    
    formattedResponseData = fixedHoursResponse;
  } else {
    if (formattedTrendsData.length > 0) {
      const responseDataMap = new Map();
      if (data?.responseTimeTrends) {
        data.responseTimeTrends.forEach(item => {
          const dateKey = formatDateForDisplay(item.date);
          responseDataMap.set(dateKey, {
            firstResponse: minutesToHours(item.firstResponse),
            resolution: minutesToHours(item.resolution),
          });
        });
      }
      
      formattedResponseData = formattedTrendsData.map(trendItem => {
        const responseData = responseDataMap.get(trendItem.displayDate);
        return {
          displayDate: trendItem.displayDate,
          fullDate: trendItem.fullDate,
          firstResponse: responseData?.firstResponse || 0,
          resolution: responseData?.resolution || 0,
        };
      });
    } else {
      formattedResponseData = data?.responseTimeTrends?.map(item => ({
        ...item,
        displayDate: formatDateForDisplay(item.date),
        fullDate: item.date,
        firstResponse: minutesToHours(item.firstResponse),
        resolution: minutesToHours(item.resolution),
      })) || [];
    }
  }

  const getResponseTimeRange = (data: any[], key: 'firstResponse' | 'resolution') => {
    if (data.length === 0) return t("no_data");
    const values = data.map(item => item[key]).filter(val => val != null && val > 0);
    if (values.length === 0) return t("no_data");
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `${min.toFixed(1)} - ${max.toFixed(1)} ${t("hours")}`;
  };

  const trendChartConfig = getTrendChartConfig(t);
  const responseChartConfig = getResponseChartConfig(t);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 ">
      {/* 左侧：工单数量趋势（带时间粒度显示器） */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        {/* 左侧标题和粒度显示器 */}
        <div className="flex h-16 p-6 justify-between items-center flex-shrink-0 self-stretch border-b border-zinc-200">
            <h2 className="text-xl  text-zinc-900">
              {t("ticket_volume_trends")}
            </h2>
            {/* 时间粒度显示器（非按钮） */}
            <div className="flex items-center gap-2 bg-white rounded-lg py-1 px-3">
              {granularityOptions.map((option) => (
                <div
                  key={option.value}
                  className={`px-3 py-1 text-lg rounded-md transition-colors border ${
                    granularity === option.value
                      ? "bg-zinc-200 text-foreground border-zinc-300 font-medium"
                      : "bg-white text-zinc-900 border-zinc-200 font-normal"
                  }`}
                >
                  {option.label}
                </div>
              ))}
            </div>
        </div>

        {/* 左侧图表内容 */}
        <div className="p-8">
          <div className="h-120 flex items-center justify-center">
            <ChartContainer config={trendChartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedTrendsData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#E4E4E7"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="#D1D5DB"
                    strokeWidth={1}
                    fontSize={11}
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    interval={granularity === "hour" ? 1 : "preserveStartEnd"}
                  />
                  <YAxis 
                    stroke="none" 
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "#E4E4E7", strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length && payload[0]?.payload) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-zinc-200 rounded-lg shadow-lg w-[200px] p-4 flex flex-col justify-center items-start gap-2">
                            <div className="text-sm font-medium text-zinc-900">
                              {data.fullDate}
                            </div>
                            <div className="border-t border-zinc-300 w-full"></div>
                            <div className="flex items-center justify-between gap-2 w-full">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2"
                                  style={{ backgroundColor: payload[0]?.color || '#2563EB' }}
                                ></div>
                                <span className="text-sm text-zinc-600">
                                  {t("ticket_count")}
                                </span>
                              </div>
                              <span className="font-semibold text-zinc-900">{data.count}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={trendChartConfig.count.color}
                    strokeWidth={2}
                    dot={{ fill: trendChartConfig.count.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: trendChartConfig.count.color, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      </div>

      {/* 右侧：工单响应时长分析（独立容器） */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        {/* 右侧标题 */}
        <div className="flex h-16 p-6 justify-between items-center flex-shrink-0 self-stretch border-b border-zinc-200">
          <h2 className="text-xl  text-zinc-900">
            {t("ticket_response_time_analysis")}
          </h2>
        </div>

        {/* 右侧内容 */}
        <div className="p-8">
          <div className="space-y-4">
            {/* 响应时长统计指标 */}
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden mb-4">
              <div className="grid grid-cols-2">
                <div className="p-4 relative">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-500"></div>
                    <span className="text-sm text-zinc-600">{t("average_first_response_time")}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="text-2xl text-black">
                      {data?.responseMetrics ? minutesToHours(data.responseMetrics.avgFirstResponseTime) : 0} {t("hours")}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {t("range")}: {getResponseTimeRange(formattedResponseData, 'firstResponse')}
                    </p>
                  </div>
                </div>

                <div className="p-4 border-l border-dashed border-zinc-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500"></div>
                    <span className="text-sm text-zinc-600">{t("average_resolution_time")}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="text-2xl text-black">
                      {data?.responseMetrics ? minutesToHours(data.responseMetrics.avgResolutionTime) : 0} {t("hours")}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {t("range")}: {getResponseTimeRange(formattedResponseData, 'resolution')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 响应时长趋势图表 */}
            <div className="h-90 flex items-center justify-center">
              {(formattedResponseData.length > 0 || granularity === "hour") ? (
                <ChartContainer config={responseChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedResponseData} margin={{ top: 20, right: 10, left: -30, bottom: 10 }}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="#E4E4E7"
                        horizontal={true}
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke="#D1D5DB"
                        strokeWidth={1}
                        fontSize={11}
                        angle={0}
                        textAnchor="middle"
                        height={40}
                        interval={granularity === "hour" ? 1 : "preserveStartEnd"}
                      />
                      <YAxis 
                        stroke="none" 
                        fontSize={12}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ChartTooltip
                        cursor={{ stroke: "#E4E4E7", strokeWidth: 1 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length && payload[0]?.payload) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-zinc-200 rounded-lg shadow-lg w-[240px] p-4 flex flex-col justify-center items-start gap-2">
                                <div className="text-sm font-medium text-zinc-900">
                                  {data.fullDate}
                                </div>
                                <div className="border-t border-zinc-300 w-full"></div>
                                <div className="flex flex-col gap-2 w-full">
                                  {payload.map((entry, index) => (
                                    <div key={index} className="flex items-center justify-between gap-2 w-full">
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-2 h-2"
                                          style={{ backgroundColor: entry.color || '#2563EB' }}
                                        ></div>
                                        <span className="text-sm text-zinc-600">
                                          {entry.dataKey === 'firstResponse' ? t("average_first_response_time") : t("average_resolution_time")}
                                        </span>
                                      </div>
                                      <span className="font-semibold text-zinc-900">
                                        {entry.value} {t("hours")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="firstResponse"
                        stroke={responseChartConfig.firstResponse.color}
                        strokeWidth={2}
                        dot={{ fill: responseChartConfig.firstResponse.color, strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: responseChartConfig.firstResponse.color, strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="resolution"
                        stroke={responseChartConfig.resolution.color}
                        strokeWidth={2}
                        dot={{ fill: responseChartConfig.resolution.color, strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: responseChartConfig.resolution.color, strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  {t("no_data")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}