import { Liquid } from "liquidjs";

// 单例引擎，开启缓存；模板一般来自配置/DB
const liquid = new Liquid({
  cache: true,
  jsTruthy: true,
  extname: ".liquid",
});

// 常用过滤器：安全截断文本
liquid.registerFilter(
  "truncate_chars",
  (input: unknown, maxLength: number = 2000) => {
    const text = typeof input === "string" ? input : String(input ?? "");
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  },
);

export async function renderTemplate(
  template: string | undefined,
  variables: Record<string, unknown>,
): Promise<string> {
  if (!template) return "";
  try {
    return await liquid.parseAndRender(template, variables);
  } catch {
    // 渲染失败时，回退为原模板，避免中断流程
    return template;
  }
}

export { liquid };
