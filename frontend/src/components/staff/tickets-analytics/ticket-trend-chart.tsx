import { useMemo } from "react";
import type { EChartsOption } from 'echarts';
import { ticketTrendsQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";
import { EChartsWrapper } from "@comp/common/echarts-wrapper";

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
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';
  
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
  }, [finalFilterParams]);

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
      case "hour": {
        const hour = date.getHours();
        return `${hour.toString().padStart(2, '0')}:00`;
      }
      case "day":
        return date.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
      case "month":
        return date.toLocaleDateString(locale, { year: "numeric", month: "numeric" });
      case "year":
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
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
        hour, 
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
        hour, 
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

  const getResponseTimeRange = (data: Array<{ firstResponse?: number; resolution?: number }>, key: 'firstResponse' | 'resolution') => {
    if (data.length === 0) return t("no_data");
    const values: number[] = data
      .map(item => item[key])
      .filter((val): val is number => typeof val === 'number' && val > 0);
    if (values.length === 0) return t("no_data");
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `${min.toFixed(1)} - ${max.toFixed(1)} ${t("hours")}`;
  };


  // ECharts配置 - 工单数量趋势
  const trendChartOption: EChartsOption = {
    grid: {
      top: 20,
      right: 10,
      left: 25,
      bottom: 40,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: formattedTrendsData.map(d => d.displayDate),
      axisLine: {
        lineStyle: {
          color: '#D1D5DB',
          width: 1,
        }
      },
      axisLabel: {
        fontSize: 11,
        color: '#6B7280',
        interval: granularity === "hour" ? 1 : 'auto',
      },
      axisTick: {
        show: false,
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false,
      },
      axisLabel: {
        fontSize: 12,
        color: '#6B7280',
      },
      splitLine: {
        lineStyle: {
          color: '#E4E4E7',
          type: 'dashed',
        }
      },
      axisTick: {
        show: false,
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      formatter: ((params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{ dataIndex?: number }>;
        const dataIndex = list[0]?.dataIndex;
        if (dataIndex === undefined) return '';
        const item = formattedTrendsData[dataIndex];
        if (!item) return '';
        return `
          <div class="min-w-[200px] bg-white border border-zinc-200 p-4">
            <div class="font-medium mb-2 text-zinc-900">${item.fullDate}</div>
            <div class="border-t border-zinc-300 pt-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 bg-blue-600"></div>
                  <span class="text-sm text-zinc-600">${t('ticket_count')}</span>
                </div>
                <span class="font-semibold text-zinc-900">${item.count}</span>
              </div>
            </div>
          </div>
        `;
      }) ,
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#E4E4E7',
          width: 1,
        }
      }
    },
    series: [
      {
        type: 'line',
        data: formattedTrendsData.map(d => d.count),
        showSymbol: false,
        lineStyle: {
          color: '#2563EB',
          width: 2,
        },
        itemStyle: {
          color: '#2563EB',
          borderWidth: 2,
        },
        symbolSize: 8,
        emphasis: {
          itemStyle: {
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(37, 99, 235, 0.3)',
          },
          scale: 1.5,
        }
      }
    ]
  };

  // ECharts配置 - 响应时长趋势
  const responseChartOption: EChartsOption = {
    grid: {
      top: 20,
      right: 10,
      left: 20,
      bottom: 50,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: formattedResponseData.map(d => d.displayDate),
      axisLine: {
        lineStyle: {
          color: '#D1D5DB',
          width: 1,
        }
      },
      axisLabel: {
        fontSize: 11,
        color: '#6B7280',
        interval: granularity === "hour" ? 1 : 'auto',
      },
      axisTick: {
        show: false,
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false,
      },
      axisLabel: {
        fontSize: 12,
        color: '#6B7280',
      },
      splitLine: {
        lineStyle: {
          color: '#E4E4E7',
          type: 'dashed',
        }
      },
      axisTick: {
        show: false,
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      formatter: ((params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{ dataIndex?: number; seriesName?: string; value?: number }>;
        const dataIndex = list[0]?.dataIndex;
        if (dataIndex === undefined) return '';
        const item = formattedResponseData[dataIndex];
        if (!item) return '';
        let content = `
          <div class="min-w-[240px] bg-white border border-zinc-200 p-4">
            <div class="font-medium mb-2 text-zinc-900">${item.fullDate}</div>
            <div class="border-t border-zinc-300 pt-2">
        `;
        list.forEach((param) => {
          const label = param.seriesName === 'firstResponse' ? t('average_first_response_time') : t('average_resolution_time');
          const colorClass = param.seriesName === 'firstResponse' ? 'bg-green-500' : 'bg-blue-600';
          content += `
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 ${colorClass}"></div>
                <span class="text-sm text-zinc-600">${label}</span>
              </div>
              <span class="font-semibold text-zinc-900">${param.value ?? 0} ${t('hours')}</span>
            </div>
          `;
        });
        content += `</div></div>`;
        return content;
      }) ,
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#E4E4E7',
          width: 1,
        }
      }
    },
    series: [
      {
        name: 'firstResponse',
        type: 'line',
        data: formattedResponseData.map(d => d.firstResponse),
        showSymbol: false,
        lineStyle: {
          color: '#10B981',
          width: 2,
        },
        itemStyle: {
          color: '#10B981',
          borderWidth: 2,
        },
        symbolSize: 8,
        emphasis: {
          itemStyle: {
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: '#10B981',
          },
          scale: 1.5,
        }
      },
      {
        name: 'resolution',
        type: 'line',
        data: formattedResponseData.map(d => d.resolution),
        showSymbol: false,
        lineStyle: {
          color: '#2563EB',
          width: 2,
        },
        itemStyle: {
          color: '#2563EB',
          borderWidth: 2,
        },
        symbolSize: 8,
        emphasis: {
          itemStyle: {
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(37, 99, 235, 0.3)',
          },
          scale: 1.5,
        }
      }
    ]
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px]">
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
          <EChartsWrapper option={trendChartOption} className="h-120 w-full" />
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
                <EChartsWrapper option={responseChartOption} className="h-90 w-full" />
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
