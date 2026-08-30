export type TransactionType = "income" | "expense";

export interface Transaction {
  date: string | null;
  description: string;
  /** Signed amount: positive = income, negative = expense. */
  amount: number;
  type: TransactionType;
  category: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
  percentOfSpending: number;
}

export interface MerchantTotal {
  name: string;
  total: number;
  count: number;
}

export interface SavingsOpportunity {
  category: string;
  spent: number;
  suggestedSaving: number;
  note: string;
}

export interface FinanceAnalysis {
  currency: string;
  totalIncome: number;
  totalSpending: number;
  net: number;
  transactionCount: number;
  dateRange: { start: string; end: string } | null;
  spendingByCategory: CategoryTotal[];
  topExpenses: Transaction[];
  topMerchants: MerchantTotal[];
  recurring: MerchantTotal[];
  biggestCategory: CategoryTotal | null;
  savingsOpportunities: SavingsOpportunity[];
  totalPotentialSaving: number;
  transactions: Transaction[];
}

const INCOME_CATEGORY = "Income";
const OTHER_CATEGORY = "Other";

// Categories that are typically discretionary — the best candidates for saving.
const DISCRETIONARY: Record<string, number> = {
  Dining: 0.3,
  Coffee: 0.4,
  Subscriptions: 0.5,
  Entertainment: 0.35,
  Shopping: 0.25,
  Travel: 0.2,
};

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  {
    category: "Income",
    keywords: [
      "payroll", "salary", "direct deposit", "deposit", "refund", "reimbursement",
      "interest earned", "cashback", "dividend", "zelle from", "venmo from",
      "transfer from", "credit ",
    ],
  },
  {
    category: "Groceries",
    keywords: [
      "grocery", "supermarket", "whole foods", "trader joe", "safeway", "kroger",
      "aldi", "costco", "walmart", "market", "publix", "wegmans", "sprouts",
    ],
  },
  {
    category: "Coffee",
    keywords: ["starbucks", "coffee", "peet", "dunkin", "cafe", "espresso", "blue bottle"],
  },
  {
    category: "Dining",
    keywords: [
      "restaurant", "mcdonald", "kfc", "pizza", "burger", "doordash", "uber eats",
      "ubereats", "grubhub", "chipotle", "taco", "sushi", "grill", "diner", "bakery",
      "bar &", "pub", "kitchen", "eatery", "wendy", "subway", "panera", "postmates",
    ],
  },
  {
    category: "Transport",
    keywords: [
      "uber", "lyft", "gas", "shell", "chevron", "exxon", "fuel", "parking",
      "transit", "metro", "train", "bus ", "toll", "bp ", "76 ", "arco",
    ],
  },
  {
    category: "Travel",
    keywords: [
      "airline", "flight", "hotel", "airbnb", "expedia", "booking.com", "delta",
      "united air", "american air", "marriott", "hilton", "motel", "resort",
    ],
  },
  {
    category: "Subscriptions",
    keywords: [
      "netflix", "spotify", "hulu", "disney", "prime video", "amazon prime",
      "youtube premium", "icloud", "google storage", "patreon", "adobe", "notion",
      "subscription", "membership", "gym", "fitness", "planet fit", "peloton",
      "dropbox", "chatgpt", "openai", "linkedin premium",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon", "target", "best buy", "nike", "apple store", "ikea", "etsy",
      "ebay", "macy", "nordstrom", "shop", "store", "h&m", "zara", "sephora",
    ],
  },
  {
    category: "Utilities",
    keywords: [
      "electric", "water bill", "gas bill", "internet", "comcast", "xfinity",
      "at&t", "verizon", "t-mobile", "utility", "phone bill", "spectrum", "pg&e",
    ],
  },
  {
    category: "Health",
    keywords: [
      "pharmacy", "cvs", "walgreens", "doctor", "clinic", "dental", "hospital",
      "insurance", "medical", "optometr", "therapy",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "cinema", "movie", "theater", "theatre", "steam", "playstation", "xbox",
      "nintendo", "concert", "ticketmaster", "amc ", "regal",
    ],
  },
  {
    category: "Cash & ATM",
    keywords: ["atm", "cash withdrawal", "withdrawal"],
  },
  {
    category: "Fees",
    keywords: ["fee", "interest charge", "overdraft", "service charge", "finance charge"],
  },
];

const INCOME_HINTS = [
  "payroll", "salary", "direct deposit", "deposit", "refund", "reimbursement",
  "interest earned", "cashback", "dividend", "credit",
];

const EXPENSE_HINTS = [
  "debit", "withdrawal", "purchase", "pos ", "payment to", "sent to", "bill pay",
];

function detectCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return OTHER_CATEGORY;
}

const AMOUNT_REGEX =
  /(\()?\s*(-|–|\+)?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))\s*(\))?\s*(cr|dr)?/gi;

const DATE_REGEX =
  /\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?)\b/i;

interface ParsedAmount {
  value: number;
  negative: boolean;
  positiveMarked: boolean;
  index: number;
  length: number;
}

function lastAmountInLine(line: string): ParsedAmount | null {
  let match: RegExpExecArray | null;
  let last: ParsedAmount | null = null;
  AMOUNT_REGEX.lastIndex = 0;
  while ((match = AMOUNT_REGEX.exec(line)) !== null) {
    const [full, openParen, sign, intPart, decPart, closeParen, crdr] = match;
    const numeric = Number(`${intPart.replace(/,/g, "")}.${decPart}`);
    if (!Number.isFinite(numeric)) {
      continue;
    }
    const negative =
      Boolean(openParen && closeParen) ||
      sign === "-" ||
      sign === "–" ||
      (crdr ? crdr.toLowerCase() === "dr" : false);
    const positiveMarked = sign === "+" || (crdr ? crdr.toLowerCase() === "cr" : false);
    last = {
      value: numeric,
      negative,
      positiveMarked,
      index: match.index,
      length: full.length,
    };
  }
  return last;
}

/**
 * Heuristically extract transactions from raw statement text (from a PDF or OCR).
 * Each non-empty line that contains a currency amount is treated as one line item.
 */
export function parseTransactions(rawText: string): Transaction[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const transactions: Transaction[] = [];

  for (const line of lines) {
    const amount = lastAmountInLine(line);
    if (!amount || amount.value === 0) {
      continue;
    }

    // Description = the line with the amount token removed.
    let description = (
      line.slice(0, amount.index) + line.slice(amount.index + amount.length)
    )
      .replace(/\s+/g, " ")
      .trim();

    const dateMatch = description.match(DATE_REGEX);
    const date = dateMatch ? dateMatch[0] : null;
    if (date) {
      description = description.replace(date, "").replace(/\s+/g, " ").trim();
    }
    description = description.replace(/^[|·:\-–\s]+|[|·:\-–\s]+$/g, "").trim();
    if (!description) {
      description = "Transaction";
    }

    const lower = description.toLowerCase();
    const category = detectCategory(description);

    let type: TransactionType;
    if (amount.positiveMarked) {
      type = "income";
    } else if (amount.negative) {
      type = "expense";
    } else if (category === INCOME_CATEGORY || INCOME_HINTS.some((h) => lower.includes(h))) {
      type = "income";
    } else if (EXPENSE_HINTS.some((h) => lower.includes(h))) {
      type = "expense";
    } else {
      type = "expense";
    }

    const signed = type === "income" ? amount.value : -amount.value;
    transactions.push({
      date,
      description: description.slice(0, 80),
      amount: signed,
      type,
      category: type === "income" ? INCOME_CATEGORY : category,
    });
  }

  return transactions;
}

function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/\b\d[\d.,x*#-]*\b/g, "")
    .replace(/[^a-z& ]/g, " ")
    .replace(/\b(pos|purchase|debit|card|payment|recurring|autopay|inc|llc|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function analyze(
  transactions: Transaction[],
  currency = "$"
): FinanceAnalysis {
  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");

  const totalSpending = round(expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0));
  const totalIncome = round(incomes.reduce((sum, t) => sum + t.amount, 0));
  const net = round(totalIncome - totalSpending);

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const entry = categoryMap.get(t.category) ?? { total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    categoryMap.set(t.category, entry);
  }
  const spendingByCategory: CategoryTotal[] = Array.from(categoryMap.entries())
    .map(([category, { total, count }]) => ({
      category,
      total: round(total),
      count,
      percentOfSpending: totalSpending > 0 ? round((total / totalSpending) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const merchantMap = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const name = normalizeMerchant(t.description) || t.description.toLowerCase();
    const entry = merchantMap.get(name) ?? { total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    merchantMap.set(name, entry);
  }
  const merchants: MerchantTotal[] = Array.from(merchantMap.entries())
    .map(([name, { total, count }]) => ({
      name: titleCase(name).trim() || "Unknown",
      total: round(total),
      count,
    }))
    .sort((a, b) => b.total - a.total);

  const topMerchants = merchants.slice(0, 5);
  const recurring = merchants
    .filter((m) => m.count >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const topExpenses = [...expenses]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);

  const dated = transactions.map((t) => t.date).filter((d): d is string => Boolean(d));
  const dateRange =
    dated.length > 0 ? { start: dated[0], end: dated[dated.length - 1] } : null;

  const savingsOpportunities: SavingsOpportunity[] = spendingByCategory
    .filter((c) => c.category in DISCRETIONARY)
    .map((c) => {
      const rate = DISCRETIONARY[c.category];
      const suggestedSaving = round(c.total * rate);
      return {
        category: c.category,
        spent: c.total,
        suggestedSaving,
        note:
          c.category === "Subscriptions"
            ? `Review recurring ${c.category.toLowerCase()} — cancelling unused ones could save ${currency}${suggestedSaving.toFixed(2)}/period.`
            : `Trimming ${c.category.toLowerCase()} by ${Math.round(rate * 100)}% could save about ${currency}${suggestedSaving.toFixed(2)}.`,
      };
    })
    .filter((o) => o.suggestedSaving > 0)
    .sort((a, b) => b.suggestedSaving - a.suggestedSaving);

  const totalPotentialSaving = round(
    savingsOpportunities.reduce((sum, o) => sum + o.suggestedSaving, 0)
  );

  return {
    currency,
    totalIncome,
    totalSpending,
    net,
    transactionCount: transactions.length,
    dateRange,
    spendingByCategory,
    topExpenses,
    topMerchants,
    recurring,
    biggestCategory: spendingByCategory[0] ?? null,
    savingsOpportunities,
    totalPotentialSaving,
    transactions,
  };
}

export function analyzeText(rawText: string, currency = "$"): FinanceAnalysis {
  return analyze(parseTransactions(rawText), currency);
}
