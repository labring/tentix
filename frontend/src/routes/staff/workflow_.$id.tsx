import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/staff/workflow_/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/staff/workflow_/$id"!</div>;
}
