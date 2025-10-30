import { authMiddleware, factory, staffOnlyMiddleware } from "../middleware.ts";
import { ticketStatusAnalysisRouter } from "./ticket-status-analysis.ts";
import { ticketTrendChartRouter } from "./ticket-trend-chart.ts";
import { moduleAnalysisRouter } from "./module-analysis.ts";
import { knowledgeBaseHitsRouter } from "./knowledge-base-hits.ts";
import { ratingAnalysisRouter } from "./rating-analysis.ts";
import { hotIssuesAnalysisRouter } from "./hot-issues-analysis.ts";

const analyticsRouter = factory
  .createApp()
  .use(authMiddleware)
  .use(staffOnlyMiddleware())
  .route("/", ticketStatusAnalysisRouter)
  .route("/", ticketTrendChartRouter)
  .route("/", moduleAnalysisRouter)
  .route("/", knowledgeBaseHitsRouter)
  .route("/", ratingAnalysisRouter)
  .route("/", hotIssuesAnalysisRouter);

export { analyticsRouter };