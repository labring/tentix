import { useTranslation } from "i18n";
import { Label, RadioGroup, RadioGroupItem } from "tentix-ui";
import { useSealos } from "src/_provider/sealos";

const languageOptions = [
  {
    value: "sealos",
    labelKey: "language_follow_sealos",
    descriptionKey: "language_follow_sealos_description",
  },
  { value: "zh", labelKey: "language_chinese", descriptionKey: undefined },
  { value: "en", labelKey: "language_english", descriptionKey: undefined },
] as const;

export function LanguageSection() {
  const { t } = useTranslation();
  const { languagePreference, setLanguagePreference } = useSealos();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-medium text-zinc-900">
          {t("language")}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {t("language_settings_description")}
        </p>
      </div>

      <RadioGroup
        value={languagePreference}
        onValueChange={(value) => {
          if (value === "sealos" || value === "zh" || value === "en") {
            setLanguagePreference(value);
          }
        }}
        className="gap-3"
      >
        {languageOptions.map((option) => (
          <div
            key={option.value}
            className="flex items-start gap-3 rounded-lg border p-4"
          >
            <RadioGroupItem
              id={`language-${option.value}`}
              value={option.value}
              className="mt-0.5"
            />
            <Label
              htmlFor={`language-${option.value}`}
              className="flex flex-1 cursor-pointer flex-col gap-1"
            >
              <span className="text-sm font-medium text-zinc-900">
                {t(option.labelKey)}
              </span>
              {option.descriptionKey && (
                <span className="text-sm text-zinc-500">
                  {t(option.descriptionKey)}
                </span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
