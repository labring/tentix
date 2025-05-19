import type { PropsWithChildren } from "react";
import { Toaster } from "tentix-ui";
import { TooltipProvider } from "tentix-ui";

export default function UIProvider({ children }: PropsWithChildren) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}
