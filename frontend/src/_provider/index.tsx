import type { PropsWithChildren, JSX, ReactNode } from "react";
import AppTanstackProvider from "./tanstack";
import { AuthProvider } from "./auth";
import UIProvider from "./ui";
import { ThemeProvider } from "./theme-provider";
export default function AppProviders({ children }: PropsWithChildren) {
  const providers = [
    AppTanstackProvider,
    AuthProvider,
    UIProvider,
    ThemeProvider
  ];
  return providers.reduce(nestProviders)({ children });
}

export function nestProviders(
  PreviousProviders: ({ children }: { children: ReactNode }) => JSX.Element,
  CurrentProvider: ({ children }: { children: ReactNode }) => JSX.Element,
) {
  return function NestedProviders({ children }: { children: ReactNode }) {
    return (
      <PreviousProviders>
        <CurrentProvider>{children}</CurrentProvider>
      </PreviousProviders>
    );
  };
}