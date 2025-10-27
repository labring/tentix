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
      model: OPENAI_CONFIG.summaryModel,
      temperature: 0.3,
      configuration: {
        baseURL: OPENAI_CONFIG.baseURL,
      },
    });

    const prompt = `你是 Sealos 工单系统的数据分析师，**只分析**工单数据并生成洞察报告。**只输出 JSON**。

## 输出协议（严格）
- 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析。
- 结构与字段：
  {
    "keyFindings": string[],    // 4个关键发现，每条 ≤100 字
    "improvements": string[],   // 4个改进建议，每条 ≤100 字  
    "strategy": string          // 综合策略建议，80-150字
  }
- 不要输出额外字段；不要包含注释或解释文本。

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

## 分析要求
- keyFindings: 基于数据趋势、优先级分布、分类占比等提取4个最重要的发现
- improvements: 针对高频问题、处理效率、用户体验等提供4个具体可行的改进建议
- strategy: 综合数据洞察给出战略建议，聚焦问题预防、流程优化、资源配置

只输出 { "keyFindings": [...], "improvements": [...], "strategy": "..." } 的 JSON。`;

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
    throw error;
  }
}