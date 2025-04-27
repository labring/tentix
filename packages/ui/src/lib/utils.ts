import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { initClient } from "@server/utils/rpc.ts";

export const apiClient = initClient("");

export type { InferRequestType, InferResponseType } from "@server/utils/rpc.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
