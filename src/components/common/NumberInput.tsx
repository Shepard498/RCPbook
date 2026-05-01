import { useEffect, useState } from "react";

interface NumberInputProps {
  value: number;
  min?: number;
  step?: string | number;
  onValueChange: (value: number) => void;
}

export function NumberInput({ value, min, step = "any", onValueChange }: NumberInputProps) {
  const [text, setText] = useState(() => String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setText(String(value));
    }
  }, [isEditing, value]);

  function commitText(nextText: string) {
    setText(nextText);

    if (nextText.trim() === "") {
      return;
    }

    const parsed = Number(nextText);
    if (!Number.isFinite(parsed)) {
      return;
    }

    onValueChange(min !== undefined ? Math.max(min, parsed) : parsed);
  }

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={text}
      onFocus={() => setIsEditing(true)}
      onChange={(event) => commitText(event.target.value)}
      onBlur={() => {
        setIsEditing(false);
        if (text.trim() === "") {
          setText(String(value));
        }
      }}
    />
  );
}
