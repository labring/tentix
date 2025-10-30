import type { EChartsOption } from 'echarts';
import { ratingAnalysisQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";
import { EChartsWrapper } from "@comp/common/echarts-wrapper";

const getRatingColors = () => ({
  unrated: "#E4E4E7",
  "1": "#F87171",
  "2": "#FB923C", 
  "3": "#FACC15",
  "4": "#3B82F6",
  "5": "#2563EB",
});

const getHandoffColors = () => ({
  handoff: "#FCD34D",
  nonHandoff: "#3B82F6",
});

interface RatingAnalysisProps {
  filterParams?: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    isToday?: boolean;
  };
  isLoading?: boolean;
}

export function RatingAnalysis({ 
  filterParams, 
  isLoading: externalLoading 
}: RatingAnalysisProps) {
  const { t } = useTranslation();

  const { data } = useSuspenseQuery(ratingAnalysisQueryOptions(filterParams));

  if (externalLoading || !data) {
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


  const totalRatings = data.ratingDistribution.reduce((sum, item) => sum + item.value, 0);

  const handoffData = [
    {
      name: t("transferred_to_agent_tickets"),
      value: data.handoffDistribution.handoffTickets,
      percentage: data.handoffDistribution.handoffRate,
      type: "handoff",
    },
    {
      name: t("not_transferred_to_agent_tickets"), 
      value: data.handoffDistribution.nonHandoffTickets,
      percentage: Number((100 - data.handoffDistribution.handoffRate).toFixed(2)),
      type: "nonHandoff",
    },
  ];

  const totalTickets = data.handoffDistribution.totalTickets;

  const ratingColors = getRatingColors();
  const handoffColors = getHandoffColors();

  const ratingColorClassMap: Record<string, string> = {
    unrated: 'bg-zinc-400',
    '1': 'bg-red-400',
    '2': 'bg-orange-400',
    '3': 'bg-yellow-400',
    '4': 'bg-blue-500',
    '5': 'bg-blue-600',
  };

  const handoffColorClassMap: Record<string, string> = {
    handoff: 'bg-amber-300',
    nonHandoff: 'bg-blue-500',
  };

  // 评分分布饼图配置
  const ratingChartOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      formatter: (params: any) => {
        return `
          <div class="min-w-[200px] bg-white border border-zinc-200 p-4">
            <div class="font-medium mb-2 text-zinc-900">${params.name}</div>
            <div class="border-t border-zinc-300 pt-2 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-sm text-zinc-600">${t('count')}</span>
                <span class="font-semibold text-zinc-900">${params.value}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-zinc-600">${t('percentage')}</span>
                <span class="font-semibold text-zinc-900">${params.data.percentage}%</span>
              </div>
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '100%'],
        center: ['50%', '50%'],
        data: data.ratingDistribution.map(item => ({
          name: item.name === "unrated" ? t("unrated") : `${item.name}${t("star")}`,
          value: item.value,
          percentage: item.percentage,
          itemStyle: {
            color: ratingColors[item.name as keyof typeof ratingColors],
          }
        })),
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          scale: false,
          scaleSize: 5,
        }
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '42%',
        style: {
          text: totalRatings.toString(),
          fill: '#18181B',
          fontSize: 30,
          fontWeight: 'bold' as any,
        }
      },
      {
        type: 'text',
        left: 'center',
        top: '57%',
        style: {
          text: t("total_rating_count"),
          fill: '#71717A',
          fontSize: 12,
        }
      }
    ] as any
  };

  // 转人工分布饼图配置
  const handoffChartOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      formatter: (params: any) => {
        return `
          <div class="min-w-[200px] bg-white border border-zinc-200 p-4">
            <div class="font-medium mb-2 text-zinc-900">${params.name}</div>
            <div class="border-t border-zinc-300 pt-2 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-sm text-zinc-600">${t('count')}</span>
                <span class="font-semibold text-zinc-900">${params.value}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-zinc-600">${t('percentage')}</span>
                <span class="font-semibold text-zinc-900">${params.data.percentage}%</span>
              </div>
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '100%'],
        center: ['50%', '50%'],
        data: handoffData.map(item => ({
          name: item.name,
          value: item.value,
          percentage: item.percentage,
          itemStyle: {
            color: handoffColors[item.type as keyof typeof handoffColors] || '#E4E4E7',
          }
        })),
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          scale: false,
          scaleSize: 5,
        }
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '42%',
        style: {
          text: totalTickets.toString(),
          fill: '#18181B',
          fontSize: 30,
          fontWeight: 'bold' as any,
        }
      },
      {
        type: 'text',
        left: 'center',
        top: '57%',
        style: {
          text: t("total_tickets"),
          fill: '#71717A',
          fontSize: 12,
        }
      }
    ] as any
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px]">
      {/* 左侧：评分点比分布 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        {/* 标题 */}
        <div className="p-6 h-16 flex items-center border-b border-zinc-200">
          <h2 className="text-xl">
            {t("rating_distribution_analysis")}
          </h2>
        </div>
        {/* 内容区域 */}
        <div className="p-8 flex items-center justify-center">
          <div className="space-y-6 items-center">
            {/* 环形图和图例 */}
            <div className="flex items-center gap-6">
              {/* 环形图 */}
              <div className="h-[192px] w-[192px]">
                <EChartsWrapper option={ratingChartOption} className="h-[192px] w-[192px]" />
              </div>

              {/* 图例列表 */}
              <table className="border-collapse min-w-[85px]">
                <tbody>
                  {data.ratingDistribution.map((item, index) => (
                    <tr key={index} className="border-b border-zinc-200">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 ${ratingColorClassMap[String(item.name)] || 'bg-zinc-400'}`}></span>
                          <span className="text-sm text-zinc-700">
                            {item.name === "unrated" ? t("unrated") : `${item.name}${t("star")}`}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-zinc-600">{t("percentage")}{item.percentage}%</td>
                      <td className="p-4 text-sm text-zinc-600 font-medium">{item.value}{t("times")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：转人工情况分布 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        {/* 标题 */}
        <div className="p-6 h-16 flex items-center border-b border-zinc-200">
          <h2 className="text-xl">
            {t("manual_transfer_distribution")}
          </h2>
        </div>

        {/* 内容区域 */}
        <div className="pt-[57px] pr-[31px] pb-[57px] pl-[32.5px] flex items-center justify-center min-h-[400px]">
          <div className="space-y-6">
            {/* 环形图和图例 */}
            {totalTickets > 0 ? (
              <div className="flex items-center gap-6">
                {/* 环形图 */}
                <div className="h-[192px] w-[192px]">
                  <EChartsWrapper option={handoffChartOption} className="h-[192px] w-[192px]" />
                </div>

                {/* 图例列表 */}
                <table className="border-collapse min-w-[85px]">
                  <tbody>
                    {handoffData.map((item, index) => (
                      <tr key={index} className="border-b border-zinc-200">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 ${handoffColorClassMap[String(item.type)] || 'bg-zinc-300'}`}></span>
                            <span className="text-sm text-zinc-700">{item.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-zinc-600">{t("percentage")}{item.percentage}%</td>
                        <td className="p-4 text-sm text-zinc-600 font-medium">{item.value}{t("times")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-zinc-500">
                {t("no_data")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
