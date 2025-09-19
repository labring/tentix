import { createFileRoute } from "@tanstack/react-router";
import { StaffSidebar } from "@comp/staff/sidebar";
import { RouteTransition } from "@comp/page-transition";

export const Route = createFileRoute("/staff/workflow")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <RouteTransition>
      <div className="flex h-screen w-full overflow-hidden">
        <StaffSidebar />

        <div>Hello "/staff/workflow"!</div>
      </div>
    </RouteTransition>
  );
}
