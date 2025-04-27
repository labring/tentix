import { AppType } from '@/api/index.ts';
import { ClientRequestOptions, hc } from 'hono/client';

// this is a trick to calculate the type when compiling
const api = hc<AppType>("");

export const initClient = (url: string, args?: ClientRequestOptions): typeof api.api =>
  hc<AppType>(url, args).api;

export type { InferRequestType, InferResponseType } from "hono/client";
