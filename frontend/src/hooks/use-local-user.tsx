import * as React from "react";
import { type UserType } from "tentix-server/rpc";
import { areaEnumArray } from "tentix-server/constants";
export interface AuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: (UserType & { area: (typeof areaEnumArray)[number] }) | null;
  updateUser: (
    userData: UserType,
    area: (typeof areaEnumArray)[number],
  ) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthContext["user"]>(() => {
    const storedUser = window.localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(
    Boolean(window.localStorage.getItem("token")),
  );
  
  // 如果有token但没有user，说明认证状态正在加载中
  const [isLoading, setIsLoading] = React.useState<boolean>(() => {
    const hasToken = Boolean(window.localStorage.getItem("token"));
    const hasUser = Boolean(window.localStorage.getItem("user"));
    return hasToken && !hasUser;
  });

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("sealosToken");
    window.localStorage.removeItem("area");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("role");
    window.localStorage.removeItem("id");
    window.localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUser(null);
    setIsLoading(false);
  }, []);

  const updateUser = React.useCallback(
    (userData: UserType, area: (typeof areaEnumArray)[number]) => {
      const userWithArea = { ...userData, area };
      setUser(userWithArea);
      setIsLoading(false); // 用户信息加载完成
      window.localStorage.setItem("user", JSON.stringify(userWithArea));
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        updateUser,
        logout,
        setIsAuthenticated,
        setIsLoading,
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
