type AIResponse = {
  id: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }[];
};

export async function getAIResponse(chatId: number, messages: { role: string; content: string }[]) {
  const data = {
    chatId,
    stream: false,
    detail: false,
    messages,
  };
  const response = await fetch(process.env.FASTGPT_API_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FASTGPT_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to get AI response");
  }
  const result: AIResponse = await response.json();
  if (result.choices[0]?.message.content) {
    return result.choices[0].message.content;
  }
  throw new Error("No response from AI");
}


