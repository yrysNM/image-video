export type QuoteCategory =
  | "any"
  | "life"
  | "time"
  | "love"
  | "success"
  | "wisdom"
  | "motivation"
  | "happiness"
  | "books";

export const QUOTE_CATEGORIES: { value: QuoteCategory; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "life", label: "Life" },
  { value: "time", label: "Time" },
  { value: "love", label: "Love" },
  { value: "success", label: "Success" },
  { value: "wisdom", label: "Wisdom" },
  { value: "motivation", label: "Motivation" },
  { value: "happiness", label: "Happiness" },
  { value: "books", label: "Book quotes" },
];
