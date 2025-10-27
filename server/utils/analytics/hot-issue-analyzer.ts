import { ChatOpenAI } from "@langchain/openai";
import * as schema from "@db/schema.ts";
import type { JSONContentZod } from "../types.ts";
import { extractText } from "../types.ts";
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { OPENAI_CONFIG } from "../kb/config.ts";
import { convertToMultimodalMessage } from "../kb/tools.ts";

async function getExistingCategoriesAndTags(db: any) {
  const categories = await db
    .select({
      category: schema.hotIssues.issueCategory,
      count: sql<number>`count(*)`,
    })
    .from(schema.hotIssues)
    .groupBy(schema.hotIssues.issueCategory)
    .orderBy(sql`count(*) DESC`)
    .limit(20);

  const tags = await db
    .select({
      tag: schema.hotIssues.issueTag,
      count: sql<number>`count(*)`,
    })
    .from(schema.hotIssues)
    .groupBy(schema.hotIssues.issueTag)
    .orderBy(sql`count(*) DESC`)
    .limit(30);

  return {
    categories: categories.map((c: any) => c.category),
    tags: tags.map((t: any) => t.tag),
  };
}

interface AIAnalysisResult {
  category: string;
  tag: string;
  confidence: number;
  reasoning?: string;
}

async function analyzeWithAI(
  title: string,
  description: JSONContentZod,
  existingCategories: string[],
  existingTags: string[]
): Promise<AIAnalysisResult> {
  const model = new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: OPENAI_CONFIG.summaryModel,
    temperature: 0.3,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });

  // 使用多模态消息转换
  const multimodalContent = convertToMultimodalMessage(description);
  const descriptionText = extractText(description);

  const promptText = `你是 Sealos 工单系统的分类助手，**只分析**工单内容并生成分类标签。**只输出 JSON**。

## 输出协议（严格）
- 只输出**不带 Markdown**的 JSON 字符串，可被 JSON.parse 成功解析。
- 结构与字段：
  {
    "category": string,      // 问题分类，优先使用现有分类
    "tag": string,          // 具体问题标签，描述问题细节
    "confidence": number,   // 分析置信度，0-1之间
    "reasoning": string     // 分析理由，≤50字
  }
- 不要输出额外字段；不要包含注释或解释文本。

## 工单内容
标题: "${title}"
描述: "${descriptionText}"

## 现有分类标签
分类: ${existingCategories.length > 0 ? existingCategories.join(", ") : "暂无"}
标签: ${existingTags.length > 0 ? existingTags.join(", ") : "暂无"}

## 分析要求
- 优先使用现有分类（相似度>70%）
- 分类简洁明确：技术问题、账户问题、支付问题、性能问题、界面问题、服务问题、系统问题
- 标签具体描述：用户无法正常登录系统、支付流程中断或失败、应用页面加载速度缓慢
- **如果包含图片，请结合图片内容进行分析**，图片可能包含错误截图、界面问题、配置信息等
- confidence: 不确定时降低置信度

只输出 { "category": "...", "tag": "...", "confidence": 0.85, "reasoning": "..." } 的 JSON。`;

  try {
    let response;
    
    if (typeof multimodalContent === 'string') {
      // 纯文本消息
      response = await model.invoke(promptText);
    } else {
      // 多模态消息（包含图片）
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: promptText },
            ...multimodalContent.filter(item => item.type === "image_url")
          ]
        }
      ];
      response = await model.invoke(messages);
    }
    
    const content = response.content.toString().trim();
    
    const jsonStr = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    
    const result = JSON.parse(jsonStr);
    
    return {
      category: result.category || "未分类",
      tag: result.tag || "其他问题",
      confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("AI分类分析失败:", error);
    throw error;
  }
}

export async function analyzeAndSaveHotIssue(
  db: any,
  ticketId: string,
  title: string,
  description: JSONContentZod
): Promise<void> {
  try {
    const { categories, tags } = await getExistingCategoriesAndTags(db);
    
    const analysis = await analyzeWithAI(
      title,
      description,
      categories,
      tags
    );
    
    await db.insert(schema.hotIssues).values({
      ticketId,
      issueCategory: analysis.category,
      issueTag: analysis.tag,
      confidence: analysis.confidence,
      isAiGenerated: true,
    });
  } catch (error) {
    throw error;
  }
}

export async function getHotIssuesStats(
  db: PostgresJsDatabase<typeof schema>,
  timeRange: { start: Date; end: Date }
) {
  const categoryStats = await db
    .select({
      category: schema.hotIssues.issueCategory,
      count: sql<number>`count(*)`,
      avgConfidence: sql<number>`avg(${schema.hotIssues.confidence})`,
    })
    .from(schema.hotIssues)
    .where(
      sql`${schema.hotIssues.createdAt} >= ${timeRange.start.toISOString()} 
          AND ${schema.hotIssues.createdAt} <= ${timeRange.end.toISOString()}`
    )
    .groupBy(schema.hotIssues.issueCategory)
    .orderBy(sql`count(*) DESC`);

  const tagStats = await db
    .select({
      category: schema.hotIssues.issueCategory,
      tag: schema.hotIssues.issueTag,
      count: sql<number>`count(*)`,
      avgConfidence: sql<number>`avg(${schema.hotIssues.confidence})`,
    })
    .from(schema.hotIssues)
    .where(
      sql`${schema.hotIssues.createdAt} >= ${timeRange.start.toISOString()} 
          AND ${schema.hotIssues.createdAt} <= ${timeRange.end.toISOString()}`
    )
    .groupBy(schema.hotIssues.issueCategory, schema.hotIssues.issueTag)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return {
    categoryStats,
    tagStats,
  };
}

