import { SiteHeader } from "@comp/site-header";
import { UserDashboardSidebar } from "@comp/user/dashboard-sidebar";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input, SidebarInset, SidebarProvider } from "tentix-ui";

export const Route = createFileRoute("/user/dashboard")({
  head: () => ({
    meta: [
      {
        title: "Ten11tix Ticket System",
      }
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SidebarProvider>
      <UserDashboardSidebar />
      <SidebarInset>
        <SiteHeader title="Support Dashboard" />
        <div className="flex flex-1 flex-col">
          <div className="relative bg-linear-to-br from-primary/10 via-primary/5 to-background px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                您好，@User，有什么需要帮忙?
              </h1>
              <div className="relative mx-auto mt-6 max-w-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <Input
                  type="text"
                  className="block w-full rounded-md border-0 py-6 pl-10 pr-3 shadow-xs ring-1 ring-inset ring-input placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm"
                  placeholder="How do I submit a new ticket?"
                  // value={searchQuery}
                  // onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>热门链接:</span>
                <div className="flex flex-wrap gap-2">
                  <a href="#" className="hover:text-primary hover:underline">
                    Tickets
                  </a>
                  <span>•</span>
                  <a href="#" className="hover:text-primary hover:underline">
                    Support
                  </a>
                  <span>•</span>
                  <a href="#" className="hover:text-primary hover:underline">
                    Notifications
                  </a>
                  <span>•</span>
                  <a href="#" className="hover:text-primary hover:underline">
                    Knowledge Base
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Support by category
              </h2>
              <p className="mt-2 text-muted-foreground">
                Explore our curated resources to find what you&apos;re looking for.
              </p>
              {/* <SupportCategories /> */}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
