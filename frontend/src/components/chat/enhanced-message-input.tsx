import React, { useState, useCallback } from "react";
import { type JSONContentZod } from "tentix-server/types";
import { useTextOptimizer } from "../../hooks/use-text-optimizer";
import { OptimizeButton, OptimizeStatus } from "./optimize-button";
import { useToast } from "tentix-ui";

interface EnhancedMessageInputProps {
  ticketId: string;
  messageType?: "public" | "internal";
  priority?: string;
  onSendMessage: (content: JSONContentZod) => Promise<void>;
  onTyping?: () => void;
  isLoading?: boolean;
  children: React.ReactElement; 
}

export function EnhancedMessageInput({
  ticketId,
  messageType = "public",
  priority,
  onTyping,
  isLoading,
  children,
}: EnhancedMessageInputProps) {
  const { toast } = useToast();
  const [currentText, setCurrentText] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  const {
    isOptimizing,
    lastOptimization,
    hasOptimization,
    optimizeText,
    undoOptimization,
    cancelOptimization,
  } = useTextOptimizer({ ticketId, messageType, priority });

  // 获取文本内容的辅助函数
  const extractTextFromContent = useCallback((content: JSONContentZod): string => {
    if (!content || !content.content) return "";
    
    const extractFromNode = (node: any): string => {
      if (typeof node === "string") return node;
      if (node.type === "text") return node.text || "";
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractFromNode).join("");
      }
      return "";
    };

    return content.content.map(extractFromNode).join(" ").trim();
  }, []);

  // 创建优化后的内容
  const createOptimizedContent = useCallback((optimizedText: string): JSONContentZod => {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: optimizedText }],
        },
      ],
    };
  }, []);

  // Tab键优化处理
  const handleOptimize = useCallback(async (text?: string) => {
    const textToOptimize = text || currentText;
    if (!textToOptimize.trim()) {
      toast({
        title: "无法优化",
        description: "请先输入一些文本",
        variant: "destructive",
      });
      return;
    }

    const result = await optimizeText(textToOptimize);
    if (result) {
      // 通过ref更新编辑器内容
      const childRef = (children as any)?.ref;
      if (childRef?.current) {
        const optimizedContent = createOptimizedContent(result.optimizedText);
        childRef.current.setContent?.(optimizedContent);
        setCurrentText(result.optimizedText);
      }
    }
  }, [currentText, optimizeText, createOptimizedContent, toast, children]);

  // 撤销优化
  const handleUndo = useCallback(() => {
    const originalText = undoOptimization();
    if (originalText) {
      const childRef = (children as any)?.ref;
      if (childRef?.current) {
        const originalContent = createOptimizedContent(originalText);
        childRef.current.setContent?.(originalContent);
        setCurrentText(originalText);
      }
    }
  }, [undoOptimization, createOptimizedContent, children]);

  // 增强子组件的props
  const childProps = children.props as any;
  const enhancedChildren = React.cloneElement(children, {
    ...childProps,
    onChange: (content: JSONContentZod) => {
      // 调用原始的onChange
      if (childProps.onChange) {
        childProps.onChange(content);
      }
      
      // 更新当前文本状态
      const text = extractTextFromContent(content);
      setCurrentText(text);
      
      // 调用onTyping
      if (onTyping) {
        onTyping();
      }
    },
    
    // 添加Tab键处理
    editorProps: {
      ...childProps.editorProps,
      handleKeyDown: (view: any, event: KeyboardEvent) => {
        // 处理Tab键
        if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          if (isEnabled && !isOptimizing && currentText.trim()) {
            handleOptimize();
            return true;
          }
        }
        
        // 调用原始的handleKeyDown
        if (childProps.editorProps?.handleKeyDown) {
          return childProps.editorProps.handleKeyDown(view, event);
        }
        
        return false;
      },
    },
  });

  return (
    <div className="border-t relative">
      {/* 优化控制栏 */}
      <div className="flex items-center justify-between p-2 border-b bg-gray-50/50">
        <div className="flex items-center gap-3">
          <OptimizeButton
            isOptimizing={isOptimizing}
            hasOptimization={hasOptimization}
            confidence={lastOptimization?.confidence}
            onOptimize={() => handleOptimize()}
            onUndo={handleUndo}
            onCancel={cancelOptimization}
            disabled={isLoading || !isEnabled}
          />
          
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-gray-600">启用Tab键优化</span>
          </label>
        </div>

        <OptimizeStatus
          isOptimizing={isOptimizing}
          hasOptimization={hasOptimization}
          confidence={lastOptimization?.confidence}
          suggestions={lastOptimization?.suggestions}
        />
      </div>
      
      {/* 增强的消息输入组件 */}
      {enhancedChildren}
    </div>
  );
}