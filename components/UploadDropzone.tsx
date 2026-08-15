"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_IMAGE_BYTES, validateImageFile } from "@/lib/validation";

interface UploadDropzoneProps {
  file: File | null;
  previewUrl: string | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function UploadDropzone({
  file,
  previewUrl,
  onFileChange,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const acceptFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setLocalError(null);
        onFileChange(null);
        return;
      }
      const error = validateImageFile(next);
      if (error) {
        setLocalError(error);
        return;
      }
      setLocalError(null);
      onFileChange(next);
    },
    [onFileChange]
  );

  return (
    <div className="space-y-3">
      <label className="field-label">Source image</label>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const dropped = event.dataTransfer.files?.[0] ?? null;
          acceptFile(dropped);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragOver
            ? "border-teal-500 bg-teal-50/70"
            : "border-slate-200 bg-slate-50/70 hover:border-teal-300"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Upload preview"
            className="mb-4 max-h-48 rounded-xl object-contain shadow-sm"
          />
        ) : (
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
        )}
        <p className="text-sm font-medium text-slate-800">
          {file ? file.name : "Drag & drop or click to upload"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          JPG or PNG, max {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            acceptFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </div>
      {localError ? (
        <p className="text-sm text-red-600" role="alert">
          {localError}
        </p>
      ) : null}
      {file ? (
        <button
          type="button"
          className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-teal-700 hover:underline"
          onClick={() => acceptFile(null)}
          disabled={disabled}
        >
          Remove image
        </button>
      ) : null}
    </div>
  );
}
