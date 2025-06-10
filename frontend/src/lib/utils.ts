import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { myFetch } from "./api-client";
import type { Options } from "ky";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EventSourceData<T extends Record<string, unknown>> = {
  event: keyof T;
  data: T[keyof T];
  id?: string;
};

function parseEventSourceData<T extends Record<string, unknown>>(
  str: string,
): EventSourceData<T> {
  const lines = str.split("\n"); // 按行分割字符串
  let event: keyof T | undefined;
  let data: T[keyof T] | undefined;
  let id: string | undefined;

  for (const line of lines) {
    const [key, value] = line.split(": ", 2); // 按照 ": " 分割每一行
    if (!key || !value) continue;

    switch (key.trim()) {
      case "event":
        event = value.trim();
        break;
      case "data":
        data = JSON.parse(value.trim());
        break;
      case "id":
        id = value.trim();
        break;
    }
  }
  if (event && data) {
    return { event, data, id };
  }
  throw new Error("Invalid event source data");
}

export function fetchStream<T extends Record<string, unknown>>(
  url: string,
  params: {
    onmessage?: (data: EventSourceData<T>) => void;
    onclose?: () => void;
  } & Options,
) {
  const fetchController = new AbortController();
  const { onmessage, onclose, ...otherParams } = params;
  const decoder = new TextDecoder("utf-8");

  async function push(
    controller: ReadableStreamDefaultController<Uint8Array<ArrayBufferLike>>,
    reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
  ) {
    const { value, done } = await reader.read();
    if (done) {
      controller.close();
      onclose?.();
    } else {
      const data = decoder.decode(value, { stream: true });
      const eventSourceData = parseEventSourceData<T>(data);
      onmessage?.(eventSourceData);
      controller.enqueue(value);
      push(controller, reader);
    }
  }
  return {
    fetch: myFetch(url, { ...otherParams, signal: fetchController.signal })
      .then((response) => {
        if (!response.body) {
          throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        const stream = new ReadableStream({
          start(controller) {
            push(controller, reader);
          },
        });
        return stream;
      })
      .then((stream) =>
        new Response(stream, {
          headers: { "Content-Type": "text/event-stream" },
        }).text(),
      ),
    abort: () => {
      fetchController.abort();
    },
  };
}
