import { ChatOpenAI } from "@langchain/openai";
import * as schema from "@db/schema.ts";
import type { JSONContentZod } from "../types.ts";
import { extractText } from "../types.ts";
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { OPENAI_CONFIG } from "../kb/config.ts";

async function getExistingCategoriesAndTags(db: any) {
  // 获取现有分类（按频次排序）
  const categories = await db
    .select({
      category: schema.hotIssues.issueCategory,
      count: sql<number>`count(*)`,
    })
    .from(schema.hotIssues)
    .groupBy(schema.hotIssues.issueCategory)
    .orderBy(sql`count(*) DESC`)
    .limit(20);

  // 获取现有标签（按频次排序）
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
  descriptionText: string,
  existingCategories: string[],
  existingTags: string[]
): Promise<AIAnalysisResult> {
  const model = new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: "gpt-4o-mini",
    temperature: 0.3,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });

  const prompt = `你是一个工单分类助手。请分析以下工单内容，并从现有分类中选择最匹配的，或建议新分类。

工单标题: "${title}"
工单描述: "${descriptionText}"

现有问题分类: ${existingCategories.length > 0 ? existingCategories.join(", ") : "暂无"}
现有问题标签: ${existingTags.length > 0 ? existingTags.join(", ") : "暂无"}

请返回JSON格式（不要使用markdown代码块）：
{
  "category": "选择的分类或新建分类",
  "tag": "选择的标签或新建标签",
  "confidence": 0.85,
  "reasoning": "分析理由"
}

分类规则：
1. 优先使用现有分类，如果现有分类中有相似的（相似度>70%）就使用现有的
2. 分类要简洁明确，常见分类如：技术问题、账户问题、支付问题、性能问题、界面问题、服务问题、系统问题
3. 标签要具体描述问题，如：用户无法正常登录系统、支付流程中断或失败、应用页面加载速度缓慢
4. confidence表示分析的置信度(0-1)，如果不确定请降低置信度
5. 只返回JSON，不要添加任何其他文字`;

  try {
    const response = await model.invoke(prompt);
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
    return {
      category: "未分类",
      tag: "待分析",
      confidence: 0.3,
      reasoning: "AI分析失败，使用默认分类",
    };
  }
}

export async function analyzeAndSaveHotIssue(
  db: any,
  ticketId: string,
  title: string,
  description: JSONContentZod
): Promise<void> {
  try {
    const descriptionText = extractText(description);
    
    const { categories, tags } = await getExistingCategoriesAndTags(db);
    
    const analysis = await analyzeWithAI(
      title,
      descriptionText,
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

