import { ChatOpenAI } from "@langchain/openai";
import { OPENAI_CONFIG } from "../kb/config.ts";

interface HotIssueData {
  category: string;
  tag: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
}

interface AIInsightsResult {
  keyFindings: string[];
  improvements: string[];
  strategy: string;
}

export async function generateAIInsights(
  topIssues: HotIssueData[],
  categoryStats: CategoryData[],
  totalIssues: number
): Promise<AIInsightsResult> {
  try {
    const model = new ChatOpenAI({
      apiKey: OPENAI_CONFIG.apiKey,
      model: "gpt-4o-mini",
      temperature: 0.3,
      configuration: {
        baseURL: OPENAI_CONFIG.baseURL,
      },
    });

    const prompt = `你是一个专业的工单数据分析师。请基于以下热门问题数据，生成专业的分析洞察报告。

## 数据概况
总问题数: ${totalIssues}

## TOP问题列表
${topIssues.slice(0, 5).map((issue, index) => 
  `${index + 1}. [${issue.category}] ${issue.tag} - ${issue.count}次 (${issue.trend === 'up' ? '上升' : issue.trend === 'down' ? '下降' : '稳定'}, ${issue.priority})`
).join('\n')}

## 分类统计
${categoryStats.slice(0, 5).map((cat) => 
  `- ${cat.category}: ${cat.count}次 (${cat.percentage}%)`
).join('\n')}

## 请按以下JSON格式输出分析报告：
{
  "keyFindings": [
    "关键发现1",
    "关键发现2",
    "关键发现3",
    "关键发现4"
  ],
  "improvements": [
    "改进建议1",
    "改进建议2",
    "改进建议3",
    "改进建议4"
  ],
  "strategy": "综合性的数据驱动策略建议（一段话）"
}

要求：
1. keyFindings: 提取4个最重要的数据发现，要具体、准确
2. improvements: 提供4个切实可行的改进建议
3. strategy: 给出一段综合性的战略建议（80-150字）
4. 语言要专业但易懂
5. 只输出JSON，不要有其他内容`;

    const response = await model.invoke(prompt);
    const content = response.content.toString();
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI返回格式错误");
    }

    const result = JSON.parse(jsonMatch[0]) as AIInsightsResult;
    
    if (!result.keyFindings || !result.improvements || !result.strategy) {
      throw new Error("AI返回数据不完整");
    }

    return result;
  } catch (error) {
    console.error("AI洞察分析失败:", error);
    
    return {
      keyFindings: [
        "数据收集中，暂无足够信息生成洞察",
        "请确保有充足的工单数据用于分析",
        "建议持续跟踪问题趋势变化",
        "关注高优先级问题的处理进度"
      ],
      improvements: [
        "建立问题分类和标签的标准流程",
        "加强团队对常见问题的培训",
        "优化工单处理和响应机制",
        "定期review和更新解决方案"
      ],
      strategy: "当前数据量不足，建议收集更多工单数据后再进行深入分析。同时建立完善的问题分类体系，为后续数据分析奠定基础。"
    };
  }
}