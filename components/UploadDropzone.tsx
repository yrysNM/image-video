"use client";

import { useCallback, useRef, useState } from "react";
import {
  COLLABORATIVE_IMAGE_COUNT,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  validateImageFile,
} from "@/lib/validation";

export interface UploadItem {
  id: string;
  file?: File;
  url: string;
  name: string;
}

interface UploadDropzoneProps {
  items: UploadItem[];
  collaborative?: boolean;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function UploadDropzone({
  items,
  collaborative = false,
  onAddFiles,
  onRemove,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const remaining = MAX_IMAGES - items.length;

  const acceptFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;

      const errors: string[] = [];
      const accepted: File[] = [];

      for (const file of incoming) {
        if (accepted.length >= remaining) {
          errors.push(`You can upload up to ${MAX_IMAGES} images.`);
          break;
        }
        const error = validateImageFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
          continue;
        }
        accepted.push(file);
      }

      setLocalError(errors[0] ?? null);
      if (accepted.length > 0) {
        onAddFiles(accepted);
      }
    },
    [onAddFiles, remaining]
  );

  const openPicker = () => {
    if (!disabled && remaining > 0) inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <label className="field-label">
        Source images
        {collaborative ? (
          <span className="ml-1 font-normal text-teal-700">
            · collaborative mode ({COLLABORATIVE_IMAGE_COUNT}/{COLLABORATIVE_IMAGE_COUNT})
          </span>
        ) : null}
      </label>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.name}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 px-2 py-1">
                <p className="truncate text-[11px] text-white">
                  {index === 0 ? "1 · first" : `${index + 1}`} · {item.name}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                disabled={disabled}
                onClick={() => onRemove(item.id)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || remaining <= 0}
        onKeyDown={(event) => {
          if (disabled || remaining <= 0) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onClick={openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && remaining > 0) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (disabled || remaining <= 0) return;
          acceptFiles(Array.from(event.dataTransfer.files ?? []));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? "border-teal-500 bg-teal-50/70"
            : "border-slate-200 bg-slate-50/70 hover:border-teal-300"
        } ${disabled || remaining <= 0 ? "pointer-events-none opacity-60" : ""}`}
      >
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
        <p className="text-sm font-medium text-slate-800">
          {items.length === 0
            ? "Drag & drop or click to upload images"
            : remaining > 0
              ? "Add more images"
              : `Maximum of ${MAX_IMAGES} images reached`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          JPG or PNG, max {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB each ·
          up to {MAX_IMAGES} images ({items.length}/{MAX_IMAGES})
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          disabled={disabled || remaining <= 0}
          onChange={(event) => {
            acceptFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      {localError ? (
        <p className="text-sm text-red-600" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
