import * as React from "react";
import { type UserType } from "tentix-server/rpc";
import { areaEnumArray } from "tentix-server/constants";
export interface AuthContext {
  isAuthenticated: boolean;
  user: (UserType & { area: (typeof areaEnumArray)[number] }) | null;
  updateUser: (
    userData: UserType,
    area: (typeof areaEnumArray)[number],
  ) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthContext["user"]>(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(
    Boolean(window.localStorage.getItem("token")),
  );

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("identity");
    window.localStorage.removeItem("area");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("role");
    window.localStorage.removeItem("id");
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const updateUser = React.useCallback(
    (userData: UserType, area: (typeof areaEnumArray)[number]) => {
      setUser({ ...userData, area });
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        updateUser,
        logout,
        setIsAuthenticated,
      }}
    >
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
