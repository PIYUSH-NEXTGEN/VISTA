import type { ImageRecord } from "@/core/storage/models";

/* Pure query helpers over the in-memory image list. The library holds its
 * records in memory during a session, so sorting, filtering, and search are
 * plain array operations — ready for unit tests without any storage setup. */

export type SortKey =
  "importedAt" | "takenAt" | "sizeBytes" | "name" | "dimensions" | "mimeType";

export type SortDirection = "asc" | "desc";

export type FormatFilterKey = "all" | "jpeg" | "png" | "webp";

export const SORT_OPTIONS: { key: SortKey; direction: SortDirection; label: string }[] = [
  { key: "importedAt", direction: "desc", label: "Newest imported" },
  { key: "importedAt", direction: "asc", label: "Oldest imported" },
  { key: "takenAt", direction: "desc", label: "Date taken (latest)" },
  { key: "takenAt", direction: "asc", label: "Date taken (earliest)" },
  { key: "name", direction: "asc", label: "Name (A-Z)" },
  { key: "name", direction: "desc", label: "Name (Z-A)" },
  { key: "sizeBytes", direction: "desc", label: "Largest files" },
  { key: "sizeBytes", direction: "asc", label: "Smallest files" },
  { key: "dimensions", direction: "desc", label: "Most pixels" },
  { key: "mimeType", direction: "asc", label: "Format (A-Z)" },
];

export const FORMAT_FILTER_OPTIONS: { key: FormatFilterKey; label: string }[] = [
  { key: "all", label: "All formats" },
  { key: "jpeg", label: "JPEG" },
  { key: "png", label: "PNG" },
  { key: "webp", label: "WebP" },
];

function sortValue(image: ImageRecord, key: SortKey): number | string {
  switch (key) {
    case "importedAt":
      return image.importedAt;
    case "takenAt":
      return image.takenAt ?? 0;
    case "sizeBytes":
      return image.sizeBytes;
    case "dimensions":
      return image.width * image.height;
    case "name":
      return image.name.toLowerCase();
    case "mimeType":
      return image.mimeType.toLowerCase();
  }
}

export function sortImages(
  images: ImageRecord[],
  key: SortKey,
  direction: SortDirection,
): ImageRecord[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...images].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right) * factor;
    }
    const difference = (left as number) - (right as number);
    // Tie-breaker keeps name order stable so equal keys do not shuffle.
    if (difference !== 0) return difference * factor;
    return a.name.localeCompare(b.name);
  });
}

export function filterByFormat(
  images: ImageRecord[],
  format: FormatFilterKey,
): ImageRecord[] {
  if (format === "all") return images;
  const mimeType = `image/${format}`;
  return images.filter((image) => image.mimeType.toLowerCase() === mimeType);
}

/* Tokens split on whitespace; every token must match at least one field:
 * file name, camera model, format, or date taken. Matching is a plain
 * lowercase substring test, so it stays fast and predictable. */
export function searchImages(images: ImageRecord[], query: string): ImageRecord[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return images;

  return images.filter((image) => {
    const fields = [
      image.name.toLowerCase(),
      (image.camera ?? "").toLowerCase(),
      image.mimeType.toLowerCase(),
      image.takenAt === undefined ? "" : takenAtTokens(image.takenAt),
    ];
    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
}

function takenAtTokens(takenAt: number): string {
  const date = new Date(takenAt);
  // ISO UTC date and an English-language form cover most useful searches.
  return `${date.toISOString().slice(0, 10)} ${date.toDateString().toLowerCase()}`;
}
