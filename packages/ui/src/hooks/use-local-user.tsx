import * as React from "react";
import { userInfoQueryOptions, useSuspenseQuery } from "tentix-ui/lib/query";
import { UserType } from "tentix-ui/lib/types";
import { areaEnumArray } from "@server/utils/const.ts";
export interface AuthContext {
  isAuthenticated: boolean;
  ck: string | null;
  user: (UserType & { area: (typeof areaEnumArray)[number] }) | null;
}

const AuthContext = React.createContext<AuthContext | null>(null);

function getCk() {
  const result = document.cookie.match(/identity=(\w+)/);
  return result?.at(1) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ck, setCk] = React.useState<AuthContext["ck"]>(getCk());
  const [user, setUser] = React.useState<AuthContext["user"]>(null);
  const isAuthenticated = Boolean(user);
  const { data: userData } = useSuspenseQuery(userInfoQueryOptions());

  React.useEffect(() => {
    const area = window.localStorage.getItem(
      "area",
    ) as (typeof areaEnumArray)[number] ?? 'hzh';
    setUser({ ...userData, area });
    setCk(getCk());
  }, [userData]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, ck, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default function useLocalUser() {
  const { user } = useAuth();
  return user!;
}
