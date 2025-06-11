import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { EVENT_NAME } from "@zjy365/sealos-desktop-sdk";
import { createSealosApp, sealosApp } from "@zjy365/sealos-desktop-sdk/app";
import { extractAreaFromSealosToken } from "@lib/sealos-area";
import { useTranslation } from "i18n";

interface SealosContextType {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  area: string | null;
}

const SealosContext = createContext<SealosContextType | null>(null);

export function SealosProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [state, setState] = useState<SealosContextType>({
    isInitialized: false,
    isLoading: true,
    error: null,
    token: null,
    area: null,
  });

  const initializationRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

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
        const sealosSession = await sealosApp.getSession();
        const sealosToken = sealosSession.token as unknown as string;
        const sealosArea = extractAreaFromSealosToken(sealosToken ?? "");

        window.localStorage.setItem("identity", sealosToken);
        window.localStorage.setItem("area", sealosArea ?? "");
        window.localStorage.setItem("token", sealosToken);

        setState({
          isInitialized: true,
          isLoading: false,
          error: null,
          token: sealosToken,
          area: sealosArea,
        });

        // cleanup
        cleanupRef.current = () => {
          cleanupEventListener?.();
          cleanupApp?.();
        };
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    };

    initializeSealos().finally(() => {
      console.info("##### sealos app and sealos info init completed #####");
    });

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <SealosContext.Provider value={state}>{children}</SealosContext.Provider>
  );
}

export function useSealos() {
  const context = useContext(SealosContext);
  if (!context) {
    throw new Error("useSealos must be used within a SealosProvider");
  }
  return context;
}
