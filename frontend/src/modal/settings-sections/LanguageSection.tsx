import { useTranslation } from "i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "tentix-ui";
import { useSealos } from "src/_provider/sealos";

const languageOptions = [
  { value: "sealos", labelKey: "language_follow_sealos" },
  { value: "zh", labelKey: "language_chinese" },
  { value: "en", labelKey: "language_english" },
] as const;

export function LanguageSection() {
  const { t } = useTranslation();
  const { languagePreference, setLanguagePreference } = useSealos();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="font-medium text-zinc-900">{t("language")}</h4>
            <p className="text-sm text-zinc-500">
              {languagePreference === "sealos"
                ? t("language_follow_sealos_description")
                : t("language_manual_hint")}
            </p>
          </div>
          <Select
            value={languagePreference}
            onValueChange={(value) => {
              if (value === "sealos" || value === "zh" || value === "en") {
                setLanguagePreference(value);
              }
            }}
          >
            <SelectTrigger className="w-[180px] h-10 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
