export function parseImageUrlsJson(value: string | null | undefined): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    const urls = parsed.filter((item): item is string => typeof item === "string");
    return urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}
