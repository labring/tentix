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
  const tentixToken = window.localStorage.getItem("token");
  if (!sealosUserId || !tentixToken) {
    blockSealosAuthGate();
    return;
  }

  const storedSealosUserId = getStoredSealosUserId();
  if (!storedSealosUserId || storedSealosUserId !== sealosUserId) {
    blockSealosAuthGate();
    clearStaleTentixSessionForSealos();
    return;
  }

  releaseSealosAuthGate();
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
  refreshSealosSession: () => Promise<RefreshedSealosSession | null>;
}

const SealosContext = createContext<SealosContextType | null>(null);

export function SealosProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [state, setState] = useState<
    Omit<SealosContextType, "refreshSealosSession">
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
  });

  const initializationRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const refreshSealosSession = useCallback(async () => {
    blockSealosAuthGate();
    try {
      const sealosSession = await sealosApp.getSession();
      const sealosToken = sealosSession.token as unknown as string;
      const sealosArea = extractAreaFromSealosToken(sealosToken ?? "");
      const sealosUserId = getSealosUserIdFromToken(sealosToken ?? "");
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
      console.warn("Refresh sealos session failed:", error);
      releaseSealosAuthGate();
      return null;
    }
  }, []);

  useEffect(() => {
    // prevent multiple initialization
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializeSealos = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const cleanupApp = createSealosApp();

        const handleI18nChange = (data: { currentLanguage: string }) => {
          const currentLng = i18n.resolvedLanguage;
          const newLng = data.currentLanguage;

          console.info("Sealos language change:", { currentLng, newLng });

          if (currentLng !== newLng) {
            i18n.changeLanguage(newLng);
            setState((prev) => ({ ...prev, currentLanguage: newLng }));
          }
        };

        const cleanupEventListener = sealosApp?.addAppEventListen(
          EVENT_NAME.CHANGE_I18N,
          handleI18nChange,
        );

        // initialize language
        const lang = await sealosApp.getLanguage();
        if (i18n.resolvedLanguage !== lang.lng) {
          i18n.changeLanguage(lang.lng);
        }

        // get session info
        console.info("Getting Sealos session...");
        blockSealosAuthGate();
        const sealosSession = await sealosApp.getSession();
        const sealosToken = sealosSession.token as unknown as string;
        const sealosArea = extractAreaFromSealosToken(sealosToken ?? "");
        const sealosUserId = getSealosUserIdFromToken(sealosToken ?? "");
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

        setState({
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
          currentLanguage: lang.lng,
        });

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
          isSealos: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
        releaseSealosAuthGate();
      }
    };

    sealosInitPromise = initializeSealos().finally(() => {
      console.info("##### sealos app and sealos info init completed #####");
    });

    return () => {
      cleanupRef.current?.();
    };
  }, [i18n]);

  useEffect(() => {
    if (!state.isSealos) return;

    const refreshCurrentSealosSession = () => {
      void refreshSealosSession();
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
    <SealosContext.Provider value={{ ...state, refreshSealosSession }}>
      {children}
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
  if (!sealosInitPromise) {
    // if not initialized, return a resolved promise (maybe server-side rendering or test environment)
    console.warn(
      "Sealos initialization promise not found, resolving immediately",
    );
    return Promise.resolve();
  }
  return sealosInitPromise.catch((error) => {
    console.error("Sealos initialization failed:", error);
    // even if initialization fails, do not throw an error, let the application continue running
    return Promise.resolve();
  });
}
