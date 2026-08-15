import { Suspense } from "react";
import { GenerateForm } from "@/components/GenerateForm";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Animate a still
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          Upload an image, describe the motion you want, and generate a short AI
          video with Runway. Swap to fal or Kling anytime with an env var.
        </p>
      </div>
      <Suspense
        fallback={<div className="card text-sm text-slate-500">Loading form…</div>}
      >
        <GenerateForm />
      </Suspense>
    </div>
  );
}
