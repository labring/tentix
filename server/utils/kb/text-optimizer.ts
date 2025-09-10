import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { OPENAI_CONFIG } from "@/utils/kb/config.ts";

export interface OptimizationContext {
  originalText: string;
  ticketModule: string;
  ticketCategory: string;
  ticketDescription: string;
  recentMessages: string;
  messageType: "public" | "internal";
  priority?: string;
}

export interface OptimizationResult {
  optimizedText: string;
  confidence: number;
  suggestions: string[];
  reasoning: string;
}

const optimizationSchema = z.object({
  optimizedText: z.string(),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()),
  reasoning: z.string(),
});

/**
 * 使用AI优化文本
 * @param context 优化上下文
 * @returns 优化结果
 */
export async function optimizeTextWithAI(
  context: OptimizationContext
): Promise<OptimizationResult> {
  
  console.log('🚀 Creating ChatOpenAI model...');
  
  try {
    const model = new ChatOpenAI({
      apiKey: OPENAI_CONFIG.apiKey,
      model: OPENAI_CONFIG.tabChatModel,
      temperature: 0.3,
      maxTokens: 1000,
      configuration: {
        baseURL: OPENAI_CONFIG.baseURL,
      },
    });

    const systemPrompt = `
你是专业的客服文本优化助手，负责优化客服回复文本，使其更加专业、清晰、友好。

## 优化原则
1. **专业性**: 使用准确的技术术语，避免口语化表达
2. **清晰性**: 逻辑清晰，步骤明确，易于理解
3. **友好性**: 保持礼貌和耐心，体现服务意识
4. **简洁性**: 去除冗余，突出重点信息
5. **一致性**: 与工单主题和上下文保持一致

## 特殊要求
- 如果是内部消息（internal），可以更加技术化和简洁
- 如果是公开消息（public），需要更加友好和易懂
- 根据优先级调整回复的紧急程度表达

## 输出格式
请严格按照以下JSON格式输出：
{
  "optimizedText": "优化后的文本",
  "confidence": 0.95,
  "suggestions": ["建议1", "建议2"],
  "reasoning": "优化理由"
}

confidence: 0-1之间的数值，表示优化质量
suggestions: 2-3条改进建议
reasoning: 简要说明优化思路
`;

    const userPrompt = `
## 工单信息
- 模块: ${context.ticketModule}
- 分类: ${context.ticketCategory}
- 描述: ${context.ticketDescription}
- 消息类型: ${context.messageType}
- 优先级: ${context.priority || "未设置"}

## 最近对话
${context.recentMessages}

## 待优化文本
${context.originalText}

请根据以上上下文优化文本，确保专业性和一致性。
`;

    console.log('🔄 Invoking AI model...');
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);

    const content = typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);
    

    let cleanContent = content.trim();
    

    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    

    const jsonStart = cleanContent.indexOf('{');
    const jsonEnd = cleanContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
    }
    
    console.log('✅ Cleaned content:', cleanContent.substring(0, 200) + '...');
    
    const result = optimizationSchema.parse(JSON.parse(cleanContent));
    return result;
  } catch (error) {
    console.error("❌ AI optimization failed:", error);
    return generateFallbackOptimization(context);
  }
}

/**
 * 生成后备优化结果（当AI服务不可用时）
 * @param context 优化上下文
 * @returns 基础优化结果
 */
function generateFallbackOptimization(context: OptimizationContext): OptimizationResult {

  let optimizedText = context.originalText;
  

  optimizedText = optimizedText
    .replace(/\s+/g, ' ') 
    .trim(); 


  if (context.messageType === 'public') {

    if (!optimizedText.includes('您好') && !optimizedText.includes('你好')) {
      optimizedText = '您好，' + optimizedText;
    }
    if (!optimizedText.includes('谢谢') && !optimizedText.includes('感谢')) {
      optimizedText += '，感谢您的理解。';
    }
  }

  return {
    optimizedText,
    confidence: 0.3, 
    suggestions: [
      "AI优化服务暂时不可用，请手动检查文本",
      "建议检查语法和专业术语的准确性",
      "确保回复符合客服标准"
    ],
    reasoning: "AI优化服务不可用，应用了基础文本清理规则"
  };
}
