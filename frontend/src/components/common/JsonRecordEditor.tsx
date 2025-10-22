import { useState, useEffect } from "react";
import type { FieldError as RHFFieldError } from "react-hook-form";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Button,
  Input,
  Textarea,
  Badge,
} from "tentix-ui";
import { CheckCircle2, XCircle, Wand2, Plus, X } from "lucide-react";

/**
 * JsonRecordEditor - A generic JSON object editor component
 *
 * Provides two editing modes:
 * 1. Simple mode: Key-value pair editor for easy data entry
 * 2. JSON mode: Direct JSON text editing with validation
 *
 * @example
 * ```tsx
 * <JsonRecordEditor
 *   label="Meta Data"
 *   description="Add custom metadata"
 *   value={metaData}
 *   onChange={setMetaData}
 * />
 * ```
 */

interface JsonRecordEditorProps {
  /** Label for the field */
  label?: string;
  /** Description text shown below the label */
  description?: string;
  /** Current value of the JSON object */
  value?: Record<string, any>;
  /** Callback when value changes */
  onChange: (value: Record<string, any>) => void;
  /** React Hook Form field error */
  error?: RHFFieldError;
  /** Placeholder for JSON mode textarea */
  placeholder?: string;
  /** Number of rows for JSON mode textarea */
  rows?: number;
  /** Show data preview badges */
  showPreview?: boolean;
}

export function JsonRecordEditor({
  label,
  description,
  value = {},
  onChange,
  error,
  placeholder = '输入 JSON 格式的数据，例如：\n{\n  "key": "value"\n}',
  rows = 8,
  showPreview = true,
}: JsonRecordEditorProps) {
  const [mode, setMode] = useState<"simple" | "json">("simple");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [keyValuePairs, setKeyValuePairs] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ]);

  // Initialize from value
  useEffect(() => {
    if (Object.keys(value).length > 0) {
      const pairs = Object.entries(value).map(([key, val]) => ({
        key,
        value: typeof val === "string" ? val : JSON.stringify(val),
      }));
      setKeyValuePairs(pairs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle JSON mode
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        setJsonError(null);
        onChange(parsed);
      } else {
        setJsonError("必须是对象格式");
      }
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch {
      setJsonError("JSON 格式错误");
    }
  };

  // Handle simple mode
  const handleAddField = () => {
    setKeyValuePairs([...keyValuePairs, { key: "", value: "" }]);
  };

  const handleRemoveField = (index: number) => {
    const newPairs = keyValuePairs.filter((_, i) => i !== index);
    setKeyValuePairs(newPairs.length > 0 ? newPairs : [{ key: "", value: "" }]);
    updateValueFromPairs(newPairs.length > 0 ? newPairs : [{ key: "", value: "" }]);
  };

  const handleKeyChange = (index: number, key: string) => {
    const newPairs = [...keyValuePairs];
    const pair = newPairs[index];
    if (pair) {
      pair.key = key;
      setKeyValuePairs(newPairs);
      updateValueFromPairs(newPairs);
    }
  };

  const handleValueChange = (index: number, val: string) => {
    const newPairs = [...keyValuePairs];
    const pair = newPairs[index];
    if (pair) {
      pair.value = val;
      setKeyValuePairs(newPairs);
      updateValueFromPairs(newPairs);
    }
  };

  const updateValueFromPairs = (pairs: Array<{ key: string; value: string }>) => {
    const obj: Record<string, any> = {};
    pairs.forEach(({ key, value: val }) => {
      if (key.trim()) {
        // Try to parse value as JSON, fallback to string
        try {
          obj[key.trim()] = JSON.parse(val);
        } catch {
          obj[key.trim()] = val;
        }
      }
    });
    onChange(obj);
  };

  // Switch between modes
  const handleModeSwitch = (newMode: "simple" | "json") => {
    if (newMode === "json" && mode === "simple") {
      // Switch to JSON mode
      setJsonText(JSON.stringify(value, null, 2));
      setJsonError(null);
    } else if (newMode === "simple" && mode === "json") {
      // Switch to simple mode
      const pairs = Object.entries(value).map(([key, val]) => ({
        key,
        value: typeof val === "string" ? val : JSON.stringify(val),
      }));
      setKeyValuePairs(pairs.length > 0 ? pairs : [{ key: "", value: "" }]);
    }
    setMode(newMode);
  };

  const hasData = Object.keys(value).length > 0;

  return (
    <Field>
      {label && (
        <div className="flex items-center justify-between">
          <FieldLabel>{label}</FieldLabel>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={mode === "simple" ? "default" : "outline"}
              onClick={() => handleModeSwitch("simple")}
              className="h-7 text-xs"
            >
              键值对
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "json" ? "default" : "outline"}
              onClick={() => handleModeSwitch("json")}
              className="h-7 text-xs"
            >
              JSON
            </Button>
          </div>
        </div>
      )}

      {description && (
        <FieldDescription>
          {description || (mode === "simple"
            ? "添加键值对来配置数据"
            : "输入 JSON 格式的数据")}
        </FieldDescription>
      )}

      {mode === "simple" ? (
        <div className="space-y-2">
          {keyValuePairs.map((pair, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="键名"
                value={pair.key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="值"
                value={pair.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveField(index)}
                className="shrink-0"
                disabled={keyValuePairs.length === 1 && !pair.key && !pair.value}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddField}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加字段
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              placeholder={placeholder}
              rows={rows}
              className="font-mono text-sm"
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
            />
            <div className="absolute top-2 right-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleFormatJson}
                className="h-7"
              >
                <Wand2 className="h-3 w-3 mr-1" />
                格式化
              </Button>
            </div>
          </div>

          {jsonError ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span>{jsonError}</span>
            </div>
          ) : jsonText && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>JSON 格式正确</span>
            </div>
          )}
        </div>
      )}

      {showPreview && hasData && (
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(value).map(([key, val]) => (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {typeof val === "string" ? val : JSON.stringify(val)}
            </Badge>
          ))}
        </div>
      )}

      <FieldError errors={error ? [error] : []} />
    </Field>
  );
}
