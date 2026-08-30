"use client";

import { useState } from "react";
import type { FinanceAnalysis } from "@/lib/finance/analyze";

interface FinanceResultsProps {
  analysis: FinanceAnalysis;
}

const CATEGORY_COLORS: Record<string, string> = {
  Travel: "bg-indigo-500",
  Shopping: "bg-pink-500",
  Utilities: "bg-sky-500",
  Groceries: "bg-emerald-500",
  Transport: "bg-amber-500",
  Dining: "bg-orange-500",
  Subscriptions: "bg-violet-500",
  Entertainment: "bg-fuchsia-500",
  Coffee: "bg-yellow-600",
  Health: "bg-rose-500",
  "Cash & ATM": "bg-slate-500",
  Fees: "bg-red-500",
  Other: "bg-slate-400",
};

function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-slate-400";
}

export function FinanceResults({ analysis }: FinanceResultsProps) {
  const [showAll, setShowAll] = useState(false);
  const c = analysis.currency;
  const fmt = (n: number) =>
    `${c}${Math.abs(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const maxCat = analysis.spendingByCategory[0]?.total ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Money in</p>
          <p className="mt-1 text-2xl font-semibold text-teal-700">
            {fmt(analysis.totalIncome)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Money out</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">
            {fmt(analysis.totalSpending)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Net</p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              analysis.net >= 0 ? "text-teal-700" : "text-rose-600"
            }`}
          >
            {analysis.net >= 0 ? "+" : "−"}
            {fmt(analysis.net)}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {analysis.transactionCount} transactions
        {analysis.dateRange
          ? ` · ${analysis.dateRange.start} → ${analysis.dateRange.end}`
          : ""}
        {analysis.currency !== "$" ? ` · ${analysis.currency}` : ""}
      </p>

      {/* Volume analysis */}
      <div className="card space-y-4">
        <h2
          className="text-lg font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Volume analysis
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Avg expense
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">
              {fmt(analysis.volumeAnalysis.averageExpenseAmount)}
            </p>
            <p className="text-xs text-slate-400">
              {analysis.volumeAnalysis.expenseCount} payments
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Avg income
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-teal-700">
              {fmt(analysis.volumeAnalysis.averageIncomeAmount)}
            </p>
            <p className="text-xs text-slate-400">
              {analysis.volumeAnalysis.incomeCount} deposits
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Daily spending
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-rose-600">
              {fmt(analysis.volumeAnalysis.averageDailySpending)}
            </p>
            <p className="text-xs text-slate-400">
              over {analysis.volumeAnalysis.daysWithTransactions} days
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Busiest day
            </p>
            {analysis.volumeAnalysis.busiestSpendingDay ? (
              <>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">
                  {fmt(analysis.volumeAnalysis.busiestSpendingDay.total)}
                </p>
                <p className="text-xs text-slate-400">
                  {analysis.volumeAnalysis.busiestSpendingDay.date}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-400">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Where you spend a lot */}
      <div className="card space-y-4">
        <div className="flex items-baseline justify-between">
          <h2
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Where your money goes
          </h2>
          {analysis.biggestCategory && (
            <span className="text-sm text-slate-500">
              Top: <span className="font-semibold text-slate-700">
                {analysis.biggestCategory.category}
              </span>{" "}
              ({analysis.biggestCategory.percentOfSpending}%)
            </span>
          )}
        </div>
        <ul className="space-y-3">
          {analysis.spendingByCategory.map((cat) => (
            <li key={cat.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{cat.category}</span>
                <span className="tabular-nums text-slate-500">
                  {fmt(cat.total)} · {cat.percentOfSpending}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${colorFor(cat.category)}`}
                  style={{ width: `${Math.max(3, (cat.total / maxCat) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Where you can save */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className="text-lg font-semibold text-teal-900"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Where you can save
          </h2>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
              Potential savings
            </p>
            <p className="text-2xl font-semibold text-teal-800">
              {fmt(analysis.totalPotentialSaving)}
            </p>
          </div>
        </div>

        {analysis.savingsOpportunities.length > 0 ? (
          <ul className="mt-4 space-y-2.5">
            {analysis.savingsOpportunities.map((o) => (
              <li
                key={o.category}
                className="flex items-start gap-3 rounded-xl bg-white/80 px-4 py-3"
              >
                <span className="mt-0.5 shrink-0 rounded-lg bg-teal-600 px-2 py-1 text-xs font-semibold text-white tabular-nums">
                  save {fmt(o.suggestedSaving)}
                </span>
                <p className="text-sm text-slate-700">{o.note}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-teal-800">
            No obvious discretionary overspending — nice work!
          </p>
        )}

        {analysis.recurring.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-teal-900">
              Recurring charges to review
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.recurring.map((m) => (
                <span
                  key={m.name}
                  className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {m.name} · {fmt(m.total)} ({m.count}×)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Biggest single expenses */}
      <div className="card">
        <h2
          className="mb-3 text-lg font-semibold text-slate-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Biggest expenses
        </h2>
        <ul className="divide-y divide-slate-100">
          {analysis.topExpenses.map((t, index) => (
            <li key={index} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {t.description}
                </p>
                <p className="text-xs text-slate-400">
                  {t.category}
                  {t.date ? ` · ${t.date}` : ""}
                </p>
              </div>
              <span className="ml-3 shrink-0 tabular-nums font-semibold text-rose-600">
                −{fmt(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* All transactions */}
      <div className="card">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            All transactions ({analysis.transactions.length})
          </span>
          <span className="text-sm font-medium text-teal-700">
            {showAll ? "Hide" : "Show"}
          </span>
        </button>
        {showAll && (
          <ul className="mt-3 divide-y divide-slate-100">
            {analysis.transactions.map((t, index) => (
              <li key={index} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{t.description}</p>
                  <p className="text-xs text-slate-400">
                    {t.category}
                    {t.date ? ` · ${t.date}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 tabular-nums text-sm font-medium ${
                    t.type === "income" ? "text-teal-700" : "text-rose-600"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {fmt(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
