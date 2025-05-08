import type { PropsWithChildren } from "react";
import { Toaster } from "tentix-ui/comp/ui/toaster";
import { TooltipProvider } from "tentix-ui/comp/ui/tooltip";

export default function UIProvider({ children }: PropsWithChildren) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}
