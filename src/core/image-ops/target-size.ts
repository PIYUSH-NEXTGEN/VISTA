export interface EncodedCandidate<T> {
  value: T;
  sizeBytes: number;
  quality: number;
}

/** Finds the highest quality that fits using a bounded monotonic search. */
export async function findBestQuality<T>(
  targetBytes: number,
  encode: (quality: number) => Promise<{ value: T; sizeBytes: number }>,
  attempts = 8,
): Promise<EncodedCandidate<T>> {
  if (!Number.isSafeInteger(targetBytes) || targetBytes < 1)
    throw new RangeError("Target size must be a positive number of bytes.");
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 16)
    throw new RangeError("Quality search attempts must be from 1 to 16.");
  let low = 0.05;
  let high = 1;
  let best: EncodedCandidate<T> | undefined;
  let smallest: EncodedCandidate<T> | undefined;
  for (let index = 0; index < attempts; index += 1) {
    const quality = (low + high) / 2;
    const result = await encode(quality);
    const candidate = { ...result, quality };
    if (!smallest || candidate.sizeBytes < smallest.sizeBytes) smallest = candidate;
    if (candidate.sizeBytes <= targetBytes) {
      best = candidate;
      low = quality;
    } else high = quality;
  }
  if (best) return best;
  throw new Error(
    `Could not reach the requested size. Smallest result: ${smallest?.sizeBytes ?? 0} bytes.`,
  );
}
