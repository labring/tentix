import { useState, useCallback, useRef } from "react";
import { useToast } from "tentix-ui";
import { useTranslation } from "i18n";

interface OptimizationResult {
  optimizedText: string;
  confidence: number;
  suggestions: string[];
  reasoning: string;
}

interface UseTextOptimizerProps {
  ticketId: string;
  messageType?: "public" | "internal";
  priority?: string;
}

export function useTextOptimizer({ 
  ticketId, 
  messageType = "public", 
  priority 
}: UseTextOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<{
    original: string;
    result: OptimizationResult;
  } | null>(null);
  
  const { toast } = useToast();
  const { t } = useTranslation();
  const abortControllerRef = useRef<AbortController | null>(null);

  const optimizeText = useCallback(async (originalText: string): Promise<OptimizationResult | null> => {
    const trimmedText = originalText.trim();
    if (!trimmedText) {
      toast({
        title: t("optimization_failed"),
        description: "文本为空，无法优化",
        variant: "destructive",
      });
      return null;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsOptimizing(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("未登录");
      }

      const response = await fetch("/api/chat/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          originalText: trimmedText,
          ticketId,
          messageType,
          priority,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const result: OptimizationResult = {
          optimizedText: data.optimizedText,
          confidence: data.confidence,
          suggestions: data.suggestions || [],
          reasoning: data.reasoning || "",
        };

        setLastOptimization({
          original: trimmedText,
          result,
        });

        toast({
          title: "优化成功",
          description: `置信度: ${Math.round(result.confidence * 100)}%`,
        });

        return result;
      } else {
        throw new Error(data.error || "优化失败");
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        return null; // 请求被取消
      }

      console.error("Text optimization error:", error);
      toast({
        title: "优化失败",
        description: error.message || "网络错误，请重试",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsOptimizing(false);
      abortControllerRef.current = null;
    }
  }, [ticketId, messageType, priority, toast, t]);

  const undoOptimization = useCallback(() => {
    if (lastOptimization) {
      const original = lastOptimization.original;
      setLastOptimization(null);
      
      toast({
        title: "已撤销优化",
        description: "文本已恢复到原始状态",
      });

      return original;
    }
    return null;
  }, [lastOptimization, toast]);

  const cancelOptimization = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsOptimizing(false);
  }, []);

  return {
    isOptimizing,
    lastOptimization: lastOptimization?.result || null,
    hasOptimization: !!lastOptimization,
    optimizeText,
    undoOptimization,
    cancelOptimization,
  };
}