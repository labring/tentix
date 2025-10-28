import { ChartContainer, ChartTooltip, ChartTooltipContent, Alert, AlertDescription, AlertTitle } from "tentix-ui";
import type { ChartConfig } from "tentix-ui";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Droplets, TriangleAlert } from "lucide-react";
import { PendingIcon, ProgressIcon, DoneIcon } from "tentix-ui";
import { analyticsOverviewQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";
const getChartConfig = (t: any) => ({
  pending: {
    label: t("pending"),
    color: "#E4E4E7",
  },
  in_progress: {
    label: t("in_progress"), 
    color: "#FACC15",
  },
  resolved: {
    label: t("resolved"),
    color: "#2563EB", 
  },
}) satisfies ChartConfig;

interface TicketStatusAnalysisProps {
  filterParams?: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    isToday?: boolean;
  };
  isLoading?: boolean;
}

export function TicketStatusAnalysis({ filterParams, isLoading: externalLoading }: TicketStatusAnalysisProps) {
  const { t } = useTranslation();
  
  const { data } = useSuspenseQuery(analyticsOverviewQueryOptions(filterParams));

  if (externalLoading || !data) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-zinc-200 rounded"></div>
            <div className="h-64 bg-zinc-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const ticketData = [
    { name: "pending", value: data.statusCounts.pending },
    { name: "in_progress", value: data.statusCounts.in_progress },
    { name: "resolved", value: data.statusCounts.resolved },
  ];

  const totalTickets = ticketData.reduce((sum, item) => sum + item.value, 0);
  const chartConfig = getChartConfig(t);

  // 关键指标数据
  const keyMetrics = [
    {
      title: t("backlog_rate"),
      value: `${data.backlogRate}%`,
      icon: Droplets,
      color: "text-indigo-500",
    },
    {
      title: t("pending_tickets"),
      value: data.statusCounts.pending.toString(),
      icon: PendingIcon,
      color: "text-zinc-400",
    },
    {
      title: t("in_progress_tickets"),
      value: data.statusCounts.in_progress.toString(),
      icon: ProgressIcon,
      color: "text-yellow-500",
    },
    {
      title: t("completion_rate"),
      value: `${data.completionRate}%`,
      icon: DoneIcon,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="w-full max-w-none min-w-0 px-0 mx-0">
      {/* 标题 */}
      <div className="h-16 justify-around gap-2 p-6 border border-solid border-zinc-200 rounded-t-lg bg-white flex items-center relative">
        <div className="flex items-center justify-between relative flex-1 grow">
          <div className="relative w-fit  text-black text-lg tracking-normal leading-normal whitespace-nowrap">
            {t("ticket_status_analysis")}
          </div>
          <div className="justify-center w-fit opacity-0 font-medium text-zinc-900 text-base tracking-normal leading-normal whitespace-nowrap flex items-center relative">
            20%
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex items-start gap-6 self-stretch bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-8">
        {/* 左侧：环形图和图例 */}
        <div className="flex-shrink-0">
          <div className="p-6">
              {/* 环形图和图例 - 使用Frame组件布局 */}
              <div className="inline-flex flex-col items-center gap-6 relative">
                <div className="flex flex-col items-center gap-9 relative" style={{ width: '192px', height: '192px', flexShrink: 0 }}>
                  <div className="relative flex-1 self-stretch w-full grow">
                    <div className="relative h-full">
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ticketData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={0}
                              dataKey="value"
                              nameKey="name"
                              labelLine={false}
                            >
                              {ticketData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={chartConfig[entry.name as keyof typeof chartConfig].color}
                                />
                              ))}
                            </Pie>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </div>

                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
                    <div className="font-bold text-foreground text-3xl text-center tracking-normal leading-normal whitespace-nowrap">
                      {totalTickets}
                    </div>
                    <div className="font-normal text-muted-foreground text-xs text-center tracking-normal leading-normal whitespace-nowrap">
                      {t("total")}{t("tkt_other")}
                    </div>
                  </div>
                </div>

                {/* 图例表格 */}
                <div className="flex flex-col w-[360px] items-start gap-2.5 relative flex-[0_0_auto] rounded-lg overflow-hidden">
                  <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                    {ticketData.map((item, index) => (
                      <div key={index} className="flex h-9 items-center relative self-stretch w-full">
                        <div className="flex min-w-[85px] items-center gap-2 pt-4 pr-4 pb-4 pl-4 relative flex-1 self-stretch grow border-b border-solid border-zinc-200">
                          <div className="inline-flex items-center gap-2 relative flex-[0_0_auto]">
                            <div 
                              className={`relative w-2 h-2 ${
                                item.name === 'pending' ? 'bg-muted-foreground' :
                                item.name === 'in_progress' ? 'bg-yellow-400' :
                                'bg-blue-600'
                              }`}
                            />
                            <div className="relative w-fit font-normal text-zinc-600 text-sm text-center tracking-normal leading-normal whitespace-nowrap">
                              {chartConfig[item.name as keyof typeof chartConfig].label}
                            </div>
                          </div>
                        </div>

                        <div className="flex min-w-[85px] gap-2.5 pt-4 pr-4 pb-4 pl-4 flex-1 self-stretch grow border-b border-solid border-zinc-200 items-center relative">
                          <div className="relative flex items-center justify-center flex-1 font-normal text-zinc-600 text-sm tracking-normal leading-normal overflow-hidden text-ellipsis">
                            {t("percentage")} {totalTickets > 0 ? ((item.value / totalTickets) * 100).toFixed(1) : '0.0'}%
                          </div>
                        </div>

                        <div className="flex min-w-[85px] items-center gap-2 pt-4 pr-4 pb-4 pl-4 relative flex-1 self-stretch grow border-b border-solid border-zinc-200">
                          <div className="relative flex items-center justify-center flex-1 font-normal text-zinc-600 text-sm tracking-normal leading-normal whitespace-nowrap">
                            {item.value} {t("times")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* 右侧：关键指标和建议 */}
        <div className="flex-1 flex flex-col items-start gap-6 self-stretch">
          {/* 关键指标卡片 */}
          <div className="w-full">
            <div className="mb-4">
                <h3 className="text-lg text-zinc-600">{t("key_metrics")}</h3>
            </div>
            <div className="w-full">
              {/* 关键指标平行排列 */}
              <div className="flex w-full border border-zinc-200 rounded-lg overflow-hidden">
                {keyMetrics.map((metric, index) => (
                  <div key={index} className="flex items-start px-5 py-6 flex-1 relative">
                    {/* 添加分割线 */}
                    {index < 3 && (
                      <div className="absolute right-0 top-0 bottom-0 w-0.5 border-l border-dashed border-zinc-200"></div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <metric.icon className={`h-5 w-5 ${metric.color} flex-shrink-0`} />
                        <span className="text-xs text-zinc-600">{metric.title}</span>
                      </div>
                      <p className="text-2xl font-bold text-zinc-900 leading-tight tracking-wider">{metric.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 建议警告框 - 在关键指标正下方 */}
          {data.backlogWarning && (
            <div className="flex flex-col items-start gap-3 self-stretch p-0">
                <h3 className="text-lg text-zinc-600">{t("suggestions")}</h3>
              <Alert variant="destructive" className="border-1 border-dashed border-black p-4 bg-gray-50">
                
                 <AlertTitle className="text-black flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-red-600" />{t("tkt_backlog_rate_error")}</AlertTitle>
                <AlertDescription className="text-black">
                  当前未处理工单占比 <span className="text-red-600 ">{data.backlogRate}%</span>，超过正常水平，建议增加处理人力。
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}