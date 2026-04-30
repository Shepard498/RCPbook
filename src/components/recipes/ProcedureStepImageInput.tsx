import type { ClipboardEvent, ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { ImageBlobRecord } from "../../domain/images/imageTypes";
import { todayIso } from "../../utils/dates";
import { createId } from "../../utils/ids";

interface ProcedureStepImageInputProps {
  imageBlobId?: string;
  onChange: (imageBlobId?: string) => void;
}

export function ProcedureStepImageInput({ imageBlobId, onChange }: ProcedureStepImageInputProps) {
  const { t } = useI18n();
  const [image, setImage] = useState<ImageBlobRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadImage() {
      if (!imageBlobId) {
        setImage(null);
        return;
      }

      const nextImage = await db.imageBlobs.get(imageBlobId);
      if (isMounted) {
        setImage(nextImage ?? null);
      }
    }

    loadImage().catch((err) => {
      if (isMounted) {
        setError(String(err));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imageBlobId]);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(image.blob);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  async function saveImage(file: File | Blob, name?: string) {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      return;
    }

    const now = todayIso();
    const nextImage: ImageBlobRecord = {
      id: createId(),
      blob: file,
      mimeType: file.type,
      name,
      size: file.size,
      createdAt: now,
      updatedAt: now,
    };

    await db.imageBlobs.put(nextImage);

    setError(null);
    onChange(nextImage.id);
  }

  async function clearImage() {
    setError(null);
    onChange(undefined);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      await saveImage(file, file.name);
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();

    if (!file) {
      return;
    }

    event.preventDefault();
    await saveImage(file, file.name || "Pasted image");
  }

  async function pasteFromClipboard() {
    setError(null);

    try {
      if (!navigator.clipboard || !("read" in navigator.clipboard)) {
        setError("Clipboard image paste is not available in this browser.");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          await saveImage(await item.getType(imageType), "Pasted image");
          return;
        }
      }

      setError("No image found on the clipboard.");
    } catch {
      setError("Clipboard permission was not granted.");
    }
  }

  return (
    <div className="image-input" onPaste={handlePaste} tabIndex={0}>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />

      {previewUrl ? (
        <img className="step-image-preview" src={previewUrl} alt={image?.name || t("Procedure step")} />
      ) : (
        <div className="step-image-empty">{t("No image")}</div>
      )}

      <div className="image-input-actions">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {t("Upload")}
        </button>
        <button type="button" onClick={pasteFromClipboard}>
          {t("Paste")}
        </button>
        <button type="button" className="danger" disabled={!imageBlobId} onClick={clearImage}>
          {t("Clear")}
        </button>
      </div>

      {error ? <div className="validation-message">{t(error)}</div> : null}
    </div>
  );
}
