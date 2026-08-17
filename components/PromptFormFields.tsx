"use client";

import type { AspectRatioOption, DurationOption } from "@/lib/types";
import {
  ASPECT_RATIO_OPTIONS,
  COLLABORATIVE_DURATION_OPTIONS,
  SINGLE_DURATION_OPTIONS,
} from "@/lib/validation";

interface PromptFormFieldsProps {
  prompt: string;
  negativePrompt: string;
  duration: DurationOption;
  aspectRatio: AspectRatioOption;
  collaborative: boolean;
  onPromptChange: (value: string) => void;
  onNegativePromptChange: (value: string) => void;
  onDurationChange: (value: DurationOption) => void;
  onAspectRatioChange: (value: AspectRatioOption) => void;
  disabled?: boolean;
}

export function PromptFormFields({
  prompt,
  negativePrompt,
  duration,
  aspectRatio,
  collaborative,
  onPromptChange,
  onNegativePromptChange,
  onDurationChange,
  onAspectRatioChange,
  disabled = false,
}: PromptFormFieldsProps) {
  const durationOptions = collaborative
    ? COLLABORATIVE_DURATION_OPTIONS
    : SINGLE_DURATION_OPTIONS;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="prompt" className="field-label">
          Motion prompt
        </label>
        <textarea
          id="prompt"
          rows={4}
          className="field-input resize-y"
          placeholder={
            collaborative
              ? 'e.g. "smooth transitions between scenes, unified cinematic motion"'
              : 'e.g. "hair blows in the wind, camera slowly zooms in"'
          }
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          disabled={disabled}
        />
      </div>

      <div>
        <label htmlFor="negativePrompt" className="field-label">
          Negative prompt{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="negativePrompt"
          rows={2}
          className="field-input resize-y"
          placeholder="What to avoid: blur, distortion, text overlays…"
          value={negativePrompt}
          onChange={(event) => onNegativePromptChange(event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="field-label">
            Duration{collaborative ? " (collaborative)" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((option) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                className={`chip ${duration === option ? "chip-active" : ""}`}
                onClick={() => onDurationChange(option)}
              >
                {option}s
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Aspect ratio</p>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIO_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                className={`chip ${aspectRatio === option ? "chip-active" : ""}`}
                onClick={() => onAspectRatioChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
