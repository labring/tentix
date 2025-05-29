import type { PropsWithChildren } from "react";
import { Toaster, TooltipProvider } from "tentix-ui";

export default function UIProvider({ children }: PropsWithChildren) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}
