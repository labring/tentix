import { fetchStream } from "@lib/utils";
import type { UnreadSSEType } from "tentix-server/types";
import { useEffect, useRef } from "react";

/**
 * @deprecated
 * This is an example of how to use the useUnreadSSE hook.
 * It is not used in the app.
 */
export function useUnreadSSEExample() {
  const sseRef = useRef<ReturnType<typeof fetchStream> | null>(null);

  useEffect(() => {
    if (sseRef.current === null) {
      sseRef.current = fetchStream<UnreadSSEType>("/api/chat/unread", {
        onmessage: (data) => {
          console.log(data);
        },
      });
    }
    return () => {
      if (sseRef.current) {
        sseRef.current.abort();
        sseRef.current = null;
      }
    };
  }, []);
}

/**
 * (parameter) data: EventSourceData<{
 *    error: {
 *        error: string;
 *    };
 *    newMsg: {
 *        userId: number;
 *        timestamp: number;
 *        roomId: string;
 *        messageId: number;
 *        content: JSONContent;
 *        isInternal: boolean;
 *    };
 *}>
 */
