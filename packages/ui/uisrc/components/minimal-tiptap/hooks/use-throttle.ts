import { useRef, useCallback, useEffect } from "react";

export function useThrottle<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const lastRan = useRef(0); // 初始值改为 0
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);

  // 保持 callback 引用最新
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;

      if (delay <= 0) {
        callbackRef.current(...args);
        return;
      }

      const now = Date.now();
      const timeSinceLastRan = now - lastRan.current;

      if (timeSinceLastRan >= delay) {
        callbackRef.current(...args);
        lastRan.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (lastArgsRef.current) {
            callbackRef.current(...lastArgsRef.current);
            lastRan.current = Date.now();
          }
        }, delay - timeSinceLastRan);
      }
    },
    [delay], // 移除 callback 依赖，避免不必要的重新创建
  );
}
