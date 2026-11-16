import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { EVENT_NAME } from "@zjy365/sealos-desktop-sdk";
import { createSealosApp, sealosApp } from "@zjy365/sealos-desktop-sdk/app";
import { decodeJWT, extractAreaFromSealosToken } from "@lib/jwt";
import type { UserType } from "tentix-server/rpc";
import { getRequestLanguage } from "@lib/language";
import {
  applyApplicationLanguage,
  getLanguagePreference,
  normalizeSupportedLanguage,
  persistLanguagePreference,
  type LanguagePreference,
  type SupportedLanguage,
} from "@lib/language";
import i18nClient, { useTranslation } from "i18n";
import { getQueryClient } from "./tanstack";
import {
  clearTentixSessionStorageOnly,
  TENTIX_SEALOS_SESSION_CLEARED_EVENT,
  TENTIX_SEALOS_USER_ID_KEY,
} from "../hooks/use-local-user";
interface SealosUserInfo {
  id: string;
  name: string;
  avatar: string;
  k8sUsername: string;
  nsid: string;
}

let sealosInitPromise: Promise<void> | null = null;

let desktopLaunch = false;
let targetPlatform: "sealos" | "generic" | null = null;
let resolveSealosInitialization: (() => void) | null = null;
const sealosInitializationReady = new Promise<void>((resolve) => { resolveSealosInitialization = resolve; });
export function getTentixTargetPlatform() { return targetPlatform; }
let verifiedSealosUserId: string | null = null;
let currentSealosUserId: string | null = null;
let authenticationFlight: { userId: string; promise: Promise<UserType> } | null = null;

export function hasSealosDesktopSession() { return desktopLaunch; }
export function isSealosAuthenticated() {
  return desktopLaunch && !!verifiedSealosUserId &&
    verifiedSealosUserId === currentSealosUserId &&
    !!window.localStorage.getItem("token");
}
export function sealosAuthenticationUrl(returnTo = window.location.pathname + window.location.search) {
  return "/?returnTo=" + encodeURIComponent(returnTo);
}
export function safeSealosReturnTo(value: string | null, role: string) {
  if (!value) return null;
  const url = new URL(value, window.location.origin);
  const prefix = role === "customer" ? "/user/" : "/staff/";
  if (url.origin !== window.location.origin || !url.pathname.startsWith(prefix)) return null;
  for (const key of ["token", "returnTo"]) url.searchParams.delete(key);
  return url.pathname + url.search + url.hash;
}
export function markSealosAuthenticated(userId: string) {
  if (!userId || userId !== currentSealosUserId) throw new Error("Sealos identity changed");
  verifiedSealosUserId = userId;
  releaseSealosAuthGate();
}

// 仅用于启动认证；普通业务请求继续等待 gate。
export function exchangeSealosSession(
  userId: string,
  userInfo: { name: string; avatar: string },
): Promise<UserType> {
  if (authenticationFlight?.userId === userId) return authenticationFlight.promise;
  const promise = (async () => {
    const token = window.localStorage.getItem("sealosToken");
    if (!token || !userId || currentSealosUserId !== userId) throw new Error("Sealos session unavailable");
    const response = await fetch("/api/auth/sealos", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": getRequestLanguage() },
      body: JSON.stringify({ token, userInfo }),
    });
    if (!response.ok) throw new Error("Sealos authentication failed");
    const session: { token: string; id: number; role: string } = await response.json();
    const info = await fetch("/api/user/info", {
      headers: { Authorization: "Bearer " + session.token, "Accept-Language": getRequestLanguage() },
    });
    if (!info.ok) throw new Error("Tentix session verification failed");
    const user: UserType = await info.json();
    if (currentSealosUserId !== userId || user.sealosId !== userId || Number(session.id) !== user.id) {
      throw new Error("Sealos identity changed");
    }
    window.localStorage.setItem("token", session.token);
    window.localStorage.setItem("id", String(user.id));
    window.localStorage.setItem("role", user.role);
    window.localStorage.setItem(TENTIX_SEALOS_USER_ID_KEY, userId);
    markSealosAuthenticated(userId);
    return user;
  })();
  authenticationFlight = { userId, promise };
  void promise.finally(() => {
    if (authenticationFlight?.promise === promise) authenticationFlight = null;
  }).catch(() => {});
  return promise;
}


const SEALOS_AUTH_GATE_TIMEOUT_MS = 10000;

let sealosAuthGateOpen = false;
let resolveSealosAuthGate: (() => void) | null = null;
let sealosAuthGatePromise = new Promise<void>((resolve) => {
  resolveSealosAuthGate = resolve;
});

function blockSealosAuthGate() {
  if (!sealosAuthGateOpen) return;
  sealosAuthGateOpen = false;
  sealosAuthGatePromise = new Promise<void>((resolve) => {
    resolveSealosAuthGate = resolve;
  });
}

export function releaseSealosAuthGate() {
  sealosAuthGateOpen = true;
  resolveSealosAuthGate?.();
}

function shouldBypassSealosAuthGate(requestUrl?: string) {
  if (!requestUrl) return false;
  return requestUrl.includes("/auth/sealos");
}

export async function waitForSealosAuthReady(requestUrl?: string) {
  if (shouldBypassSealosAuthGate(requestUrl)) return;
  if (sealosAuthGateOpen) return;

  await Promise.race([
    sealosAuthGatePromise,
    new Promise<void>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(i18nClient.t("sealos_auth_not_ready")));
      }, SEALOS_AUTH_GATE_TIMEOUT_MS);
    }),
  ]);
}

function getSealosUserIdFromToken(token: string | null) {
  if (!token) return null;
  return decodeJWT<{ userId?: string }>(token)?.userId ?? null;
}

function getStoredSealosUserId() {
  const explicitUserId = window.localStorage.getItem(TENTIX_SEALOS_USER_ID_KEY);
  if (explicitUserId) return explicitUserId;

  const rawUser = window.localStorage.getItem("user");
  if (!rawUser) return null;

  try {
    return (JSON.parse(rawUser) as { sealosId?: string }).sealosId ?? null;
  } catch {
    return null;
  }
}

function clearStaleTentixSessionForSealos() {
  clearTentixSessionStorageOnly();
  getQueryClient().clear();
  window.dispatchEvent(new Event(TENTIX_SEALOS_SESSION_CLEARED_EVENT));
}

function syncTentixSessionForSealos(sealosUserId: string | null) {
  currentSealosUserId = sealosUserId;
  if (sealosUserId && verifiedSealosUserId === sealosUserId &&
      window.localStorage.getItem("token") && getStoredSealosUserId() === sealosUserId) {
    releaseSealosAuthGate();
    return;
  }
  blockSealosAuthGate();
  const changed = !!verifiedSealosUserId && verifiedSealosUserId !== sealosUserId;
  verifiedSealosUserId = null;
  clearStaleTentixSessionForSealos();
  if (changed) window.location.assign(sealosAuthenticationUrl());
}

interface RefreshedSealosSession {
  sealosToken: string | null;
  sealosArea: string | null;
  sealosUser: SealosUserInfo | null;
  sealosUserId: string | null;
  sealosNs: string | null;
  sealosKubeconfig: string | null;
}

interface SealosContextType {
  isInitialized: boolean;
  isLoading: boolean;
  isSealos: boolean;
  error: string | null;
  sealosToken: string | null;
  sealosArea: string | null;
  sealosUser: SealosUserInfo | null;
  sealosUserId: string | null;
  sealosNs: string | null;
  sealosKubeconfig: string | null;
  currentLanguage: string | null;
  languagePreference: LanguagePreference;
  setLanguagePreference: (preference: LanguagePreference) => void;
  refreshSealosSession: () => Promise<RefreshedSealosSession | null>;
}

const SealosContext = createContext<SealosContextType | null>(null);

export function SealosProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [state, setState] = useState<
    Omit<SealosContextType, "refreshSealosSession" | "setLanguagePreference">
  >({
    isInitialized: false,
    isLoading: true,
    isSealos: false,
    error: null,
    sealosToken: null,
    sealosArea: null,
    sealosUser: null,
    sealosUserId: null,
    sealosNs: null,
    sealosKubeconfig: null,
    currentLanguage: null,
    languagePreference: getLanguagePreference(),
  });

  const initializationRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setLanguagePreference = useCallback(
    (languagePreference: LanguagePreference) => {
      persistLanguagePreference(languagePreference);
      setState((prev) => ({ ...prev, languagePreference }));
    },
    [],
  );

  useEffect(() => {
    applyApplicationLanguage(state.languagePreference, state.currentLanguage);
  }, [state.currentLanguage, state.languagePreference]);

  const refreshSealosSession = useCallback(async () => {
    blockSealosAuthGate();
    try {
      const sealosSession = await sealosApp.getSession();
      const sealosToken = sealosSession.token as unknown as string;
      const sealosArea = extractAreaFromSealosToken(sealosToken ?? "");
      const sealosUserId = getSealosUserIdFromToken(sealosToken ?? "");
      desktopLaunch = true;
      const sealosNs = sealosSession.user.nsid;
      const sealosKubeconfig =
        typeof sealosSession.kubeconfig === "string"
          ? sealosSession.kubeconfig
          : null;

      window.localStorage.setItem("sealosToken", sealosToken);
      window.localStorage.setItem("sealosArea", sealosArea ?? "");
      window.localStorage.setItem("sealosNs", sealosNs ?? "");
      syncTentixSessionForSealos(sealosUserId);

      setState((prev) => ({
        ...prev,
        isSealos: true,
        error: null,
        sealosToken,
        sealosArea,
        sealosUser: sealosSession.user,
        sealosUserId,
        sealosNs,
        sealosKubeconfig,
      }));

      return {
        sealosToken: sealosToken ?? null,
        sealosArea,
        sealosUser: sealosSession.user,
        sealosUserId,
        sealosNs,
        sealosKubeconfig,
      };
    } catch (error) {
      setState((prev) => ({ ...prev, error: "Sealos session refresh failed" }));
      throw error;
    }
  }, []);

  useEffect(() => {
    // prevent multiple initialization
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializeSealos = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const platform = await fetch("/api/auth/platform").then(async (response) => {
          if (!response.ok) throw new Error("Platform check failed");
          return response.json() as Promise<{ targetPlatform: string }>;
        });
        if (!["sealos", "generic"].includes(platform.targetPlatform)) throw new Error("Unknown platform");
        targetPlatform = platform.targetPlatform as "sealos" | "generic";

        const cleanupApp = createSealosApp();

        let currentLanguage: SupportedLanguage | null = null;
        let hasReceivedLanguageChange = false;

        const handleI18nChange = (data?: { currentLanguage?: string }) => {
          const currentLng = i18n.resolvedLanguage;
          const newLng = normalizeSupportedLanguage(data?.currentLanguage);
          if (!newLng) return;

          hasReceivedLanguageChange = true;
          currentLanguage = newLng;

          console.info("Sealos language change:", { currentLng, newLng });

          setState((prev) => ({ ...prev, currentLanguage: newLng }));
        };

        const cleanupEventListener = sealosApp?.addAppEventListen(
          EVENT_NAME.CHANGE_I18N,
          handleI18nChange,
        );

        void sealosApp
          .getLanguage()
          .then((lang) => {
            if (hasReceivedLanguageChange) {
              return;
            }
            const hostLanguage = normalizeSupportedLanguage(lang.lng);
            if (!hostLanguage) return;

            currentLanguage = hostLanguage;
            setState((prev) => ({
              ...prev,
              currentLanguage: hostLanguage,
            }));
          })
          .catch((error) => {
            console.warn("Failed to initialize Sealos language:", error);
          });

        // get session info
        console.info("Getting Sealos session...");
        blockSealosAuthGate();
        const sealosSession = await sealosApp.getSession();
        const sealosToken = sealosSession.token as unknown as string;
        const sealosArea = extractAreaFromSealosToken(sealosToken ?? "");
        const sealosUserId = getSealosUserIdFromToken(sealosToken ?? "");
      desktopLaunch = true;
        const sealosNs = sealosSession.user.nsid;
        const sealosKubeconfig =
          typeof sealosSession.kubeconfig === "string"
            ? sealosSession.kubeconfig
            : null;

        window.localStorage.setItem("sealosToken", sealosToken);
        window.localStorage.setItem("sealosArea", sealosArea ?? "");
        window.localStorage.setItem("sealosNs", sealosNs ?? "");
        syncTentixSessionForSealos(sealosUserId);

        console.info("Sealos data saved to localStorage");

        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          isSealos: true,
          error: null,
          sealosToken,
          sealosArea,
          sealosUser: sealosSession.user,
          sealosUserId,
          sealosNs,
          sealosKubeconfig,
          currentLanguage: currentLanguage ?? prev.currentLanguage,
        }));

        // cleanup
        cleanupRef.current = () => {
          cleanupEventListener?.();
          cleanupApp?.();
        };
      } catch (error) {
        console.info(
          "Maybe not in Sealos environment, Sealos initialization failed, error info:",
          error,
        );
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          isSealos: desktopLaunch,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
        releaseSealosAuthGate();
      }
    };

    sealosInitPromise = initializeSealos().finally(() => {
      resolveSealosInitialization?.();
      console.info("##### sealos app and sealos info init completed #####");
    });

    return () => {
      cleanupRef.current?.();
    };
  }, [i18n]);

  useEffect(() => {
    if (!state.isSealos) return;

    const refreshCurrentSealosSession = () => {
      void refreshSealosSession().catch(() => {
        // refreshSealosSession 已保存可见错误，gate 保持关闭。
      });
    };
    const refreshVisibleSealosSession = () => {
      if (document.visibilityState === "visible") {
        refreshCurrentSealosSession();
      }
    };

    window.addEventListener("focus", refreshCurrentSealosSession);
    document.addEventListener("visibilitychange", refreshVisibleSealosSession);

    return () => {
      window.removeEventListener("focus", refreshCurrentSealosSession);
      document.removeEventListener(
        "visibilitychange",
        refreshVisibleSealosSession,
      );
    };
  }, [state.isSealos, refreshSealosSession]);

  return (
    <SealosContext.Provider
      value={{ ...state, refreshSealosSession, setLanguagePreference }}
    >
      {desktopLaunch && state.error && (
        <div role="alert" className="p-6">
          <p>{state.error}</p>
          <button onClick={() => {
            if (!state.sealosUserId) {
              window.location.reload();
              return;
            }
            void refreshSealosSession().then(() => {
              setState((prev) => ({ ...prev, error: null }));
            }).catch(() => {});
          }}>重试 Sealos 认证</button>
        </div>
      )}
      <div hidden={desktopLaunch && !!state.error}>{children}</div>
    </SealosContext.Provider>
  );
}

export function useSealos() {
  const context = useContext(SealosContext);
  if (!context) {
    throw new Error("useSealos must be used within a SealosProvider");
  }
  return context;
}

export async function waitForSealosInit(): Promise<void> {
  await sealosInitializationReady;
  await sealosInitPromise;
}
