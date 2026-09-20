import { createFileRoute, redirect } from "@tanstack/react-router";
import { PriorityBadge } from "tentix-ui";
import { useTranslation } from "i18n";

export const Route = createFileRoute("/notLogin")({
  beforeLoad: async ({ context: { authContext } }) => {
    if (authContext.user?.id !== undefined && authContext.user !== null) {
      redirect({
        to: "/user/tickets/list",
        throw: true,
      });
    }
  },
  component: RouteComponent,
});
function RouteComponent() {
  const { t } = useTranslation();
  return (
    <div>
      {t("not_login_message")}
      <PriorityBadge priority="urgent" />
    </div>
  );
}
