import * as React from "react";
import { type UserType } from "tentix-server/rpc";
import { areaEnumArray } from "tentix-server/constants";

export const TENTIX_SEALOS_USER_ID_KEY = "tentixSealosUserId";
export const TENTIX_SEALOS_SESSION_CLEARED_EVENT =
  "tentix-sealos-session-cleared";

const TENTIX_SESSION_KEYS = [
  "token",
  "role",
  "id",
  "user",
  TENTIX_SEALOS_USER_ID_KEY,
] as const;

export function clearTentixSessionStorageOnly() {
  TENTIX_SESSION_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export interface AuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  user:
    | (UserType & {
        sealosArea?: (typeof areaEnumArray)[number];
        sealosNs?: string;
      })
    | null;
  updateUser: (
    userData: UserType,
    sealosArea?: (typeof areaEnumArray)[number],
    sealosNs?: string,
  ) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearTentixSessionOnly: () => void;
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

  // 如果有token但没有user，说明认证状态正在加载中，isLoading 表示拿用户数据的这个阶段
  const [isLoading, setIsLoading] = React.useState<boolean>(() => {
    const hasToken = Boolean(window.localStorage.getItem("token"));
    const hasUser = Boolean(window.localStorage.getItem("user"));
    return hasToken && !hasUser;
  });

  const clearTentixSessionOnly = React.useCallback(() => {
    clearTentixSessionStorageOnly();
    setIsAuthenticated(false);
    setUser(null);
    setIsLoading(false);
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("sealosToken");
    window.localStorage.removeItem("sealosArea");
    window.localStorage.removeItem("sealosNs");
    clearTentixSessionOnly();
  }, [clearTentixSessionOnly]);

  React.useEffect(() => {
    const handleSealosSessionCleared = () => {
      clearTentixSessionOnly();
    };

    window.addEventListener(
      TENTIX_SEALOS_SESSION_CLEARED_EVENT,
      handleSealosSessionCleared,
    );

    return () => {
      window.removeEventListener(
        TENTIX_SEALOS_SESSION_CLEARED_EVENT,
        handleSealosSessionCleared,
      );
    };
  }, [clearTentixSessionOnly]);

  const updateUser = React.useCallback(
    (
      userData: UserType,
      sealosArea?: (typeof areaEnumArray)[number],
      sealosNs?: string,
    ) => {
      const userWithArea = {
        ...userData,
        ...(sealosArea && { sealosArea }),
        ...(sealosNs && { sealosNs }),
      };
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
        clearTentixSessionOnly,
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
