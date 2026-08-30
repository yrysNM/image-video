import type { Metadata } from "next";
import { FinanceAnalyzer } from "@/components/FinanceAnalyzer";

export const metadata: Metadata = {
  title: "Finance Analysis · ImageToVideo",
  description:
    "Upload a bank screenshot or PDF statement to see where your money goes and where you can save.",
};

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Finance analysis
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          Upload a screenshot of your bank transactions or a PDF statement. You&apos;ll
          get a breakdown of where you spend the most and where you could save.
        </p>
      </div>
      <FinanceAnalyzer />
    </div>
  );
}
