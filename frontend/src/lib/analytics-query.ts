import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "./api-client";

const buildAnalyticsParams = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  module?: string;
  isToday?: boolean;
  limit?: string;
  granularity?: "hour" | "day" | "month";
}) => {
  const searchParams = new URLSearchParams();

  if (filterParams?.isToday) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    searchParams.set("startDate", todayStart.toISOString());
    searchParams.set("endDate", todayEnd.toISOString());
  } else {
    if (filterParams?.startDate) {
      searchParams.append("startDate", filterParams.startDate);
    }
    if (filterParams?.endDate) {
      searchParams.append("endDate", filterParams.endDate);
    }
  }

  if (filterParams?.agentId && filterParams.agentId !== "all") {
    searchParams.append("agentId", filterParams.agentId);
  }

  if (filterParams?.module && filterParams.module !== "all") {
    searchParams.append("module", filterParams.module);
  }

  if (filterParams?.limit) {
    searchParams.append("limit", filterParams.limit);
  }
  if (filterParams?.granularity) {
    searchParams.append("granularity", filterParams.granularity);
  }

  return searchParams;
};

const analyticsQueryConfig = {
  staleTime: 0, // 数据立即过期，确保刷新时重新获取
  refetchOnMount: false,
  refetchOnWindowFocus: false,
};

export const ticketStatusAnalysisQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["ticketStatusAnalysis", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["ticket-status"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

export const ticketTrendsQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  granularity?: "hour" | "day" | "month";
}) =>
  queryOptions({
    queryKey: ["ticketTrends", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["ticket-trends"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

export const moduleAnalysisQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["moduleAnalysis", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      console.log('[Frontend] Fetching module analysis with params:', filterParams);
      const data = await apiClient.analytics["module-analysis"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      console.log('[Frontend] Module analysis data received:', data);
      return data;
    },
    ...analyticsQueryConfig,
  });

export const hotIssuesQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  limit?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["hotIssues", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      console.log('[Frontend] Fetching hot issues with params:', filterParams);
      const response = await apiClient.analytics["hot-issues"]
        .$get({ query: Object.fromEntries(searchParams) });
      const data = await response.json();
      console.log('[Frontend] Hot issues data received:', data);
      return data;
    },
    ...analyticsQueryConfig,
  });

export const ratingAnalysisQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["ratingAnalysis", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["rating-analysis"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

export const knowledgeHitsQueryOptions = (filterParams?: {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  module?: string;
  isToday?: boolean;
}) =>
  queryOptions({
    queryKey: ["knowledgeHits", filterParams],
    queryFn: async () => {
      const searchParams = buildAnalyticsParams(filterParams);

      const data = await apiClient.analytics["knowledge-hits"]
        .$get({ query: Object.fromEntries(searchParams) })
        .then((r) => r.json());
      return data;
    },
    ...analyticsQueryConfig,
  });

