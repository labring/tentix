import i18n from "i18n";

export type SupportedLanguage = "zh" | "en";
export type LanguagePreference = "sealos" | SupportedLanguage;

export const LANGUAGE_PREFERENCE_STORAGE_KEY =
  "tentix-language-preference";

export function normalizeSupportedLanguage(
  language: string | null | undefined,
): SupportedLanguage | null {
  if (!language) return null;

  const baseLanguage = language.toLowerCase().split("-")[0];
  return baseLanguage === "zh" || baseLanguage === "en" ? baseLanguage : null;
}

export function getLanguagePreference(): LanguagePreference {
  if (typeof window === "undefined") return "sealos";

  try {
    const preference = window.localStorage.getItem(
      LANGUAGE_PREFERENCE_STORAGE_KEY,
    );
    return preference === "zh" || preference === "en" || preference === "sealos"
      ? preference
      : "sealos";
  } catch {
    return "sealos";
  }
}

export function persistLanguagePreference(preference: LanguagePreference) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    return;
  }
}

export function getBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return "zh";

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  return (
    candidates
      .map(normalizeSupportedLanguage)
      .find((language): language is SupportedLanguage => language !== null) ?? "zh"
  );
}

export function resolveApplicationLanguage(
  preference: LanguagePreference,
  sealosLanguage?: string | null,
): SupportedLanguage {
  if (preference !== "sealos") return preference;

  return normalizeSupportedLanguage(sealosLanguage) ?? getBrowserLanguage();
}

export function applyApplicationLanguage(
  preference: LanguagePreference,
  sealosLanguage?: string | null,
) {
  const language = resolveApplicationLanguage(preference, sealosLanguage);
  if (
    normalizeSupportedLanguage(i18n.resolvedLanguage ?? i18n.language) !==
    language
  ) {
    void i18n.changeLanguage(language);
  }
  return language;
}

export function initializeApplicationLanguage() {
  applyApplicationLanguage(getLanguagePreference());
}

export function getRequestLanguage(): SupportedLanguage {
  return normalizeSupportedLanguage(i18n.resolvedLanguage ?? i18n.language) ?? "zh";
}
