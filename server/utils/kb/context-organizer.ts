import { ChatOpenAI } from "@langchain/openai";
import { OPENAI_CONFIG } from "@/utils/kb/config.ts";

export interface RawTicketData {
  userId: string;
  userName: string;
  namespace: string;
  region: string;
  ticketId: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  recentMessages: string;
  createdAt: string;
  category: string;
  module: string;
}

/**
 * 使用AI整理工单上下文信息
 * @param rawData 原始工单数据
 * @returns 整理后的上下文文本
 */
export async function organizeContextWithAI(rawData: RawTicketData): Promise<string> {
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
你是专业的工单上下文整理助手，负责将工单信息整理成清晰、专业、结构化的格式，方便技术人员快速了解工单情况。

## 整理原则
1. **准确性**: 保持所有信息的准确性，不要编造或修改原始数据
2. **结构化**: 使用清晰的层次结构和格式
3. **专业性**: 使用技术术语，保持专业的表达方式
4. **完整性**: 包含所有关键信息，便于技术分析

## 输出格式要求
请严格按照以下格式整理工单上下文：

用户信息
• 用户ID: [用户ID]
• 用户名称: [用户名称]
• 命名空间: [命名空间]
• 区域: [区域]

工单基础信息  
• 工单ID: [工单ID]
• 标题: [工单标题]
• 模块: [相关模块]
• 分类: [工单分类]
• 优先级: [优先级]
• 状态: [当前状态]
• 创建时间: [创建时间]

问题描述
[整理和总结问题描述，使其更清晰易懂，自然段总结]

对话记录摘要
[总结最近的关键对话内容，突出重要信息]

🔧 技术要点
• 涉及组件: [相关技术组件]
• 问题类型: [问题分类]
• 影响范围: [影响评估]

请确保格式整洁，信息准确，便于技术人员快速理解工单状况。
`;

    const userPrompt = `
请根据以下工单原始数据，按照上述格式要求进行专业整理：

原始数据:
- 用户名称: ${rawData.userName}
- 用户ID: ${rawData.userId}
- 命名空间: ${rawData.namespace}
- 区域: ${rawData.region}
- 工单ID: ${rawData.ticketId}
- 标题: ${rawData.title}
- 模块: ${rawData.module}
- 分类: ${rawData.category}
- 优先级: ${rawData.priority}
- 状态: ${rawData.status}
- 创建时间: ${rawData.createdAt}
- 问题描述: ${rawData.description}
- 最近对话: ${rawData.recentMessages}

请整理成专业的技术工单上下文信息。
`;

    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);

    const content = typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);

    return content;
  } catch (error) {
    console.error("AI整理上下文失败:", error);
    
    // 返回后备格式
    return generateFallbackFormat(rawData);
  }
}

/**
 * 生成后备格式（当AI服务不可用时）
 * @param rawData 原始工单数据
 * @returns 基础格式的上下文文本
 */
function generateFallbackFormat(rawData: RawTicketData): string {
  return `
📋 用户信息
• 用户ID: ${rawData.userId}
• 用户名称: ${rawData.userName}
• 命名空间: ${rawData.namespace}
• 区域: ${rawData.region}

🎫 工单基础信息
• 工单ID: ${rawData.ticketId}
• 标题: ${rawData.title}
• 模块: ${rawData.module}
• 分类: ${rawData.category}
• 优先级: ${rawData.priority}
• 状态: ${rawData.status}
• 创建时间: ${rawData.createdAt}

🔍 问题描述
${rawData.description}

💬 对话记录
${rawData.recentMessages}

(注: AI整理服务暂时不可用，显示基础格式)`;
}
