import { useI18n } from "../../app/i18n";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const { t } = useI18n();

  return (
    <label>
      {t("Search")}
      <input
        type="search"
        value={value}
        placeholder={placeholder ? t(placeholder) : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
