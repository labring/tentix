import { Button } from "tentix-ui";
import { SparklesIcon, UndoIcon, XIcon, Loader2Icon } from "lucide-react";

interface OptimizeButtonProps {
  isOptimizing: boolean;
  hasOptimization: boolean;
  confidence?: number;
  onOptimize: () => void;
  onUndo: () => void;
  onCancel: () => void;
  disabled?: boolean;
  className?: string;
}

export function OptimizeButton({
  isOptimizing,
  hasOptimization,
  confidence,
  onOptimize,
  onUndo,
  onCancel,
  disabled = false,
  className = "",
}: OptimizeButtonProps) {

  // 优化中状态
  if (isOptimizing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-8 px-2"
          disabled={disabled}
        >
          <XIcon className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 text-xs text-blue-600">
          <Loader2Icon className="h-3 w-3 animate-spin" />
          <span>优化中...</span>
        </div>
      </div>
    );
  }

  // 已优化状态
  if (hasOptimization) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          size="sm"
          variant="outline"
          onClick={onUndo}
          className="h-8 px-2"
          disabled={disabled}
          title="撤销优化"
        >
          <UndoIcon className="h-4 w-4" />
        </Button>
        {typeof confidence === "number" && (
          <div className="text-xs text-green-600 font-medium">
            置信度: {Math.round(confidence * 100)}%
          </div>
        )}
      </div>
    );
  }

  // 默认状态
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onOptimize}
      className={`h-8 px-2 ${className}`}
      disabled={disabled}
      title="按Tab键或点击优化文本"
    >
      <SparklesIcon className="h-4 w-4" />
      <span className="sr-only">优化文本</span>
    </Button>
  );
}

interface OptimizeStatusProps {
  isOptimizing: boolean;
  hasOptimization: boolean;
  confidence?: number;
  suggestions?: string[];
  className?: string;
}

export function OptimizeStatus({
  isOptimizing,
  hasOptimization,
  confidence,
  suggestions = [],
  className = "",
}: OptimizeStatusProps) {
  if (isOptimizing) {
    return (
      <div className={`text-xs text-blue-600 ${className}`}>
        AI正在优化文本，请稍候...
      </div>
    );
  }

  if (hasOptimization && confidence !== undefined) {
    return (
      <div className={`text-xs space-y-1 ${className}`}>
        <div className="text-green-600">
          ✓ 文本已优化 (置信度: {Math.round(confidence * 100)}%)
        </div>
        {suggestions.length > 0 && (
          <div className="text-gray-500">
            建议: {suggestions[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`text-xs text-gray-400 ${className}`}>
      按Tab键快速优化文本
    </div>
  );
}